import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { ChatCompletion } from '@cerebras/cerebras_cloud_sdk/resources/chat/completions.js';
import type { LLMClient, CompletionOptions, CerebrasConfig, ToolDefinition, ToolCallOptions, ToolCallResponse, ToolCallResult } from './types.js';

const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_DELAY_MS = 30000;

function isCompletionResponse(
  response: ChatCompletion,
): response is ChatCompletion.ChatCompletionResponse {
  return 'choices' in response && 'object' in response && response.object === 'chat.completion';
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

  constructor(config: CerebrasConfig, client?: Cerebras) {
    this.client = client ?? new Cerebras({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: CompletionOptions
  ): Promise<string> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt },
          ],
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
        });

        if (!isCompletionResponse(response)) {
          continue;
        }

        // Track token usage
        if (response.usage?.total_tokens) {
          this.totalTokens += response.usage.total_tokens;
        }

        const content = response.choices[0]?.message?.content;
        if (content) {
          return content;
        }
      } catch (error) {
        if (!this.isRetryable(error)) {
          throw error;
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

    throw new Error(`LLM request failed after ${this.maxRetries} retries`);
  }

  async completeWithTools(
    systemPrompt: string,
    userPrompt: string,
    tools: ToolDefinition[],
    options?: ToolCallOptions
  ): Promise<ToolCallResponse> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
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

        if (!isCompletionResponse(response)) {
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
        if (!this.isRetryable(error)) {
          throw error;
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

    throw new Error(`LLM tool calling request failed after ${this.maxRetries} retries`);
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
