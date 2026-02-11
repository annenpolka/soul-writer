import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { ChatCompletion } from '@cerebras/cerebras_cloud_sdk/resources/chat/completions.js';
import type { LLMClient, CompletionOptions, CerebrasConfig, ToolDefinition, ToolCallOptions, ToolCallResponse, ToolCallResult } from './types.js';
import type { CircuitBreaker } from './circuit-breaker.js';

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 2000;
const DEFAULT_MAX_RETRY_DELAY_MS = 60000;

function isCompletionResponse(
  response: ChatCompletion,
): response is ChatCompletion.ChatCompletionResponse {
  return 'choices' in response && 'object' in response && response.object === 'chat.completion';
}

function getRetryAfterMs(error: unknown): number | null {
  if (error && typeof error === 'object' && 'status' in error && 'headers' in error) {
    const status = (error as { status: number }).status;
    if (status === 429) {
      const headers = (error as { headers: Record<string, string> }).headers;
      const retryAfter = headers?.['retry-after'];
      if (retryAfter) {
        const waitSec = parseInt(retryAfter, 10);
        if (!isNaN(waitSec) && waitSec > 0) {
          return Math.min(waitSec * 1000, 120_000);
        }
      }
    }
  }
  return null;
}

function formatLastError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    const message = 'message' in error ? String((error as { message: string }).message) : '';
    return `HTTP ${status}: ${message}`;
  }
  return String(error);
}

/**
 * Cerebras LLM Client implementation
 */
export class CerebrasClient implements LLMClient {
  private client: Cerebras;
  private model: string;
  private totalTokens: number = 0;
  private maxRetries: number;
  private initialRetryDelayMs: number;
  private maxRetryDelayMs: number;
  private circuitBreaker?: CircuitBreaker;

  constructor(config: CerebrasConfig, client?: Cerebras, circuitBreaker?: CircuitBreaker) {
    this.client = client ?? new Cerebras({
      apiKey: config.apiKey,
      maxRetries: 2,
      timeout: 120_000,
    });
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.circuitBreaker = circuitBreaker;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: CompletionOptions
  ): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const apiCall = () => this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt },
          ],
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
        });

        const response = this.circuitBreaker
          ? await this.circuitBreaker.execute(apiCall)
          : await apiCall();

        if (!isCompletionResponse(response)) {
          lastError = new Error('Invalid response format from LLM');
          continue;
        }

        if (response.usage?.total_tokens) {
          this.totalTokens += response.usage.total_tokens;
        }

        const content = response.choices[0]?.message?.content;
        if (content) {
          return content;
        }
        lastError = new Error('Empty response from LLM');
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error)) {
          throw error;
        }

        const retryAfterMs = getRetryAfterMs(error);
        if (retryAfterMs !== null) {
          await this.sleep(retryAfterMs);
          continue;
        }
      }

      // Exponential backoff with jitter
      if (attempt < this.maxRetries - 1) {
        const baseDelay = Math.min(
          this.initialRetryDelayMs * Math.pow(2, attempt),
          this.maxRetryDelayMs
        );
        const jitter = Math.random() * 0.5 + 0.75; // 0.75-1.25x
        await this.sleep(baseDelay * jitter);
      }
    }

    throw new Error(`LLM request failed after ${this.maxRetries} retries: ${formatLastError(lastError)}`);
  }

  async completeWithTools(
    systemPrompt: string,
    userPrompt: string,
    tools: ToolDefinition[],
    options?: ToolCallOptions
  ): Promise<ToolCallResponse> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const apiCall = () => this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt },
          ],
          tools,
          tool_choice: options?.toolChoice,
          parallel_tool_calls: options?.parallelToolCalls,
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
        });

        const response = this.circuitBreaker
          ? await this.circuitBreaker.execute(apiCall)
          : await apiCall();

        if (!isCompletionResponse(response)) {
          lastError = new Error('Invalid response format from LLM');
          continue;
        }

        if (response.usage?.total_tokens) {
          this.totalTokens += response.usage.total_tokens;
        }

        const choice = response.choices[0];
        const message = choice?.message;
        const toolCalls: ToolCallResult[] = (message?.tool_calls ?? []).map((tc: any) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));

        return {
          toolCalls,
          content: message?.content ?? null,
          tokensUsed: response.usage?.total_tokens ?? 0,
        };
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error)) {
          throw error;
        }

        const retryAfterMs = getRetryAfterMs(error);
        if (retryAfterMs !== null) {
          await this.sleep(retryAfterMs);
          continue;
        }
      }

      if (attempt < this.maxRetries - 1) {
        const baseDelay = Math.min(
          this.initialRetryDelayMs * Math.pow(2, attempt),
          this.maxRetryDelayMs
        );
        const jitter = Math.random() * 0.5 + 0.75;
        await this.sleep(baseDelay * jitter);
      }
    }

    throw new Error(`LLM tool calling request failed after ${this.maxRetries} retries: ${formatLastError(lastError)}`);
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }

  private isRetryable(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      // 400 tool_calls generation failure is transient and retryable
      if (status === 400) {
        const message = 'message' in error ? String((error as { message: string }).message) : '';
        return message.includes('tool_call') || message.includes('tool_calls');
      }
      // Other 4xx client errors (except 429) are not retryable
      if (status > 400 && status < 500 && status !== 429) {
        return false;
      }
    }
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
