import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { ChatCompletion } from '@cerebras/cerebras_cloud_sdk/resources/chat/completions.js';
import { z, type ZodType } from 'zod';
import type { LLMClient, CompletionOptions, CerebrasConfig, ToolDefinition, ToolCallOptions, ToolCallResponse, ToolCallResult, LLMMessage, StructuredResponse } from './types.js';
import type { CircuitBreaker } from './circuit-breaker.js';

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 2000;
const DEFAULT_MAX_RETRY_DELAY_MS = 60000;

// Keywords not supported by Cerebras strict mode JSON Schema
const UNSUPPORTED_KEYWORDS = new Set([
  '$schema', 'minLength', 'maxLength', 'pattern', 'format',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'multipleOf', 'minItems', 'maxItems', 'uniqueItems',
  'minProperties', 'maxProperties', 'default', 'examples',
  'description', 'title', '$comment',
]);

/**
 * Strip JSON Schema keywords unsupported by Cerebras strict mode.
 * Context-aware: keys inside "properties" are property names (never stripped).
 */
function stripUnsupportedKeywords(obj: unknown, insideProperties = false): unknown {
  if (Array.isArray(obj)) {
    return obj.map(item => stripUnsupportedKeywords(item, false));
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (insideProperties) {
        // Keys here are property names (e.g. "description", "title") — keep them
        result[key] = stripUnsupportedKeywords(value, false);
      } else if (UNSUPPORTED_KEYWORDS.has(key)) {
        continue;
      } else if (key === 'properties') {
        result[key] = stripUnsupportedKeywords(value, true);
      } else {
        result[key] = stripUnsupportedKeywords(value, false);
      }
    }
    return result;
  }
  return obj;
}

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
    systemPromptOrMessages: string | LLMMessage[],
    userPromptOrOptions?: string | CompletionOptions,
    options?: CompletionOptions
  ): Promise<string> {
    // Resolve overload: (string, string, options?) or (LLMMessage[], options?)
    let messages: Array<{ role: string; content: string; reasoning?: string }>;
    let resolvedOptions: CompletionOptions | undefined;

    if (typeof systemPromptOrMessages === 'string') {
      messages = [
        { role: 'system', content: systemPromptOrMessages },
        { role: 'user', content: userPromptOrOptions as string },
      ];
      resolvedOptions = options;
    } else {
      messages = systemPromptOrMessages;
      resolvedOptions = userPromptOrOptions as CompletionOptions | undefined;
    }

    let lastError: unknown = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const apiCall = () => this.client.chat.completions.create({
          model: this.model,
          messages: messages as any,
          temperature: resolvedOptions?.temperature,
          max_tokens: resolvedOptions?.maxTokens,
          top_p: resolvedOptions?.topP,
          reasoning_format: resolvedOptions?.reasoningFormat,
          clear_thinking: false,
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

  async completeStructured<T>(
    messages: LLMMessage[],
    schema: ZodType<T>,
    options?: CompletionOptions
  ): Promise<StructuredResponse<T>> {
    const jsonSchema = stripUnsupportedKeywords(z.toJSONSchema(schema));
    let lastError: unknown = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const apiCall = () => this.client.chat.completions.create({
          model: this.model,
          messages: messages as any,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'response',
              schema: jsonSchema,
              strict: true,
            },
          },
          reasoning_format: options?.reasoningFormat ?? 'parsed',
          temperature: options?.temperature ?? 1.0,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          clear_thinking: false,
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

        const message = response.choices[0]?.message;
        const content = message?.content;
        if (!content) {
          lastError = new Error('Empty response from LLM');
          continue;
        }

        const data = schema.parse(JSON.parse(content));
        const reasoning = message?.reasoning ?? null;

        return {
          data,
          reasoning,
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

      // Exponential backoff with jitter
      if (attempt < this.maxRetries - 1) {
        const baseDelay = Math.min(
          this.initialRetryDelayMs * Math.pow(2, attempt),
          this.maxRetryDelayMs
        );
        const jitter = Math.random() * 0.5 + 0.75;
        await this.sleep(baseDelay * jitter);
      }
    }

    throw new Error(`LLM structured request failed after ${this.maxRetries} retries: ${formatLastError(lastError)}`);
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
          reasoning_format: options?.reasoningFormat ?? 'parsed',
          clear_thinking: false,
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
          reasoning: message?.reasoning ?? null,
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
