/**
 * CodexClient — LLMClient implementation using OpenAI Codex OAuth.
 * Sends requests to chatgpt.com/backend-api/codex/responses.
 */

import { z, type ZodType } from 'zod';
import type {
  LLMClient,
  LLMMessage,
  CompletionOptions,
  StructuredResponse,
} from '../types.js';
import { CODEX_BASE_URL, type CodexConfig, type CodexToken, type TokenStore } from './types.js';
import { refreshAccessToken } from './auth.js';
import { parseSSEStream } from './sse-parser.js';

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 2000;
const DEFAULT_MAX_RETRY_DELAY_MS = 60000;
const DEFAULT_INSTRUCTIONS = 'You are a helpful assistant.';

/**
 * Convert a JSON Schema to OpenAI strict mode format.
 * OpenAI requires all properties to be in `required` array.
 * Properties that were optional become nullable instead.
 */
function makeStrictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null) return schema;

  const result = { ...schema };

  if (result.properties && typeof result.properties === 'object') {
    const props = result.properties as Record<string, Record<string, unknown>>;
    const currentRequired = new Set(Array.isArray(result.required) ? result.required as string[] : []);
    const allKeys = Object.keys(props);

    // Recursively process nested properties
    const newProps: Record<string, unknown> = {};
    for (const key of allKeys) {
      let prop = makeStrictSchema(props[key]);

      // If key was not required, make it nullable
      if (!currentRequired.has(key)) {
        if (prop.type && typeof prop.type === 'string' && !prop.properties) {
          // Simple type without nested properties: "number" -> ["number", "null"]
          prop = { ...prop, type: [prop.type, 'null'] };
        } else {
          // Complex type (object with properties, arrays, etc.): wrap in anyOf
          prop = { anyOf: [prop, { type: 'null' }] };
        }
      }

      newProps[key] = prop;
    }

    result.properties = newProps;
    result.required = allKeys;
  }

  // Process items in arrays
  if (result.items && typeof result.items === 'object') {
    result.items = makeStrictSchema(result.items as Record<string, unknown>);
  }

  return result;
}

/**
 * Recursively strip null values from an object, converting them to undefined.
 * This allows Zod optional() fields to accept values that OpenAI returns as null.
 */
function stripNulls(obj: unknown): unknown {
  if (obj === null) return undefined;
  if (Array.isArray(obj)) return obj.map(stripNulls);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== null) {
        result[key] = stripNulls(value);
      }
      // null values are simply omitted (= undefined in JS)
    }
    return result;
  }
  return obj;
}

interface ResponsesInputItem {
  type: 'message';
  role: string;
  content: Array<{ type: string; text: string }>;
}

export class CodexClient implements LLMClient {
  private model: string;
  private instructions: string;
  private totalTokens: number = 0;
  private maxRetries: number;
  private initialRetryDelayMs: number;
  private maxRetryDelayMs: number;
  private tokenStore: TokenStore;
  private fetchFn: typeof fetch;
  private cachedToken: CodexToken | null = null;
  private refreshPromise: Promise<CodexToken> | null = null;

  constructor(config: CodexConfig) {
    this.model = config.model;
    this.instructions = config.instructions ?? DEFAULT_INSTRUCTIONS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;

    if (!config.tokenStore) {
      throw new Error('CodexClient requires a tokenStore');
    }
    this.tokenStore = config.tokenStore;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  async complete(
    systemPromptOrMessages: string | LLMMessage[],
    userPromptOrOptions?: string | CompletionOptions,
    options?: CompletionOptions,
  ): Promise<string> {
    let instructions: string;
    let input: ResponsesInputItem[];
    let resolvedOptions: CompletionOptions | undefined;

    if (typeof systemPromptOrMessages === 'string') {
      instructions = systemPromptOrMessages;
      input = [this.toInputItem('user', userPromptOrOptions as string)];
      resolvedOptions = options;
    } else {
      const { instructions: instr, input: inp } = this.convertMessages(systemPromptOrMessages);
      instructions = instr;
      input = inp;
      resolvedOptions = userPromptOrOptions as CompletionOptions | undefined;
    }

    const body = this.buildRequestBody(instructions, input, resolvedOptions);
    const responseData = await this.executeWithRetry(body);

    this.totalTokens += responseData.tokensUsed;
    return responseData.text;
  }

  async completeStructured<T>(
    messages: LLMMessage[],
    schema: ZodType<T>,
    options?: CompletionOptions,
  ): Promise<StructuredResponse<T>> {
    const { instructions, input } = this.convertMessages(messages);
    const jsonSchema = z.toJSONSchema(schema);
    const strictSchema = makeStrictSchema(jsonSchema as Record<string, unknown>);

    const body = this.buildRequestBody(instructions, input, options, {
      text: {
        format: {
          type: 'json_schema',
          name: 'response',
          strict: true,
          schema: strictSchema,
        },
      },
    });

    const responseData = await this.executeWithRetry(body);
    this.totalTokens += responseData.tokensUsed;

    const raw = JSON.parse(responseData.text);
    // OpenAI strict mode returns null for optional fields; convert to undefined for Zod
    const data = schema.parse(stripNulls(raw));

    return {
      data,
      reasoning: responseData.reasoning,
      tokensUsed: responseData.tokensUsed,
    };
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }

  // --- Private methods ---

  private convertMessages(messages: LLMMessage[]): { instructions: string; input: ResponsesInputItem[] } {
    let instructions = this.instructions;
    const input: ResponsesInputItem[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        instructions = msg.content;
      } else {
        input.push(this.toInputItem(msg.role, msg.content));
      }
    }

    return { instructions, input };
  }

  private toInputItem(role: string, text: string): ResponsesInputItem {
    const contentType = role === 'assistant' ? 'output_text' : 'input_text';
    return {
      type: 'message',
      role,
      content: [{ type: contentType, text }],
    };
  }

  private buildRequestBody(
    instructions: string,
    input: ResponsesInputItem[],
    _options?: CompletionOptions,
    extra?: Record<string, unknown>,
  ): Record<string, unknown> {
    // Note: Codex ChatGPT backend does not support temperature, max_output_tokens, top_p.
    // CompletionOptions are accepted for interface compatibility but ignored.
    return {
      model: this.model,
      instructions,
      input,
      store: false,
      stream: true,
      reasoning: { effort: 'medium', summary: 'auto' },
      include: ['reasoning.encrypted_content'],
      ...extra,
    };
  }

  private async executeWithRetry(body: Record<string, unknown>) {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const token = await this.getValidToken();

        const response = await this.fetchFn(`${CODEX_BASE_URL}/codex/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${token.access_token}`,
            'chatgpt-account-id': token.chatgpt_account_id,
            'originator': 'codex_cli_rs',
            'OpenAI-Beta': 'responses=experimental',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const status = response.status;
          const text = await response.text();

          // 401: try token refresh once
          if (status === 401 && attempt === 0) {
            this.cachedToken = null;
            lastError = new Error(`HTTP ${status}: ${text}`);
            continue;
          }

          // Non-retryable errors
          if (status >= 400 && status < 500 && status !== 429) {
            throw new Error(`HTTP ${status}: ${text}`);
          }

          lastError = new Error(`HTTP ${status}: ${text}`);

          // 429: respect Retry-After
          if (status === 429) {
            const retryAfter = response.headers.get('retry-after');
            if (retryAfter) {
              const waitMs = Math.min(parseInt(retryAfter, 10) * 1000, 120_000);
              if (!isNaN(waitMs) && waitMs > 0) {
                await this.sleep(waitMs);
                continue;
              }
            }
          }
        } else {
          // Success — parse SSE stream
          if (!response.body) {
            lastError = new Error('Response has no body');
            continue;
          }

          return await parseSSEStream(response.body);
        }
      } catch (error) {
        lastError = error;

        // Non-retryable: check if the error message contains a 4xx status
        if (error instanceof Error) {
          const match = error.message.match(/HTTP (\d+)/);
          if (match) {
            const status = parseInt(match[1], 10);
            if (status >= 400 && status < 500 && status !== 429) {
              throw error;
            }
          }
        }
      }

      // Exponential backoff with jitter
      if (attempt < this.maxRetries - 1) {
        const baseDelay = Math.min(
          this.initialRetryDelayMs * Math.pow(2, attempt),
          this.maxRetryDelayMs,
        );
        const jitter = Math.random() * 0.5 + 0.75;
        await this.sleep(baseDelay * jitter);
      }
    }

    throw new Error(`Codex request failed after ${this.maxRetries} retries: ${this.formatError(lastError)}`);
  }

  private async getValidToken(): Promise<CodexToken> {
    if (!this.cachedToken) {
      this.cachedToken = await this.tokenStore.load();
    }

    if (!this.cachedToken) {
      throw new Error('Not authenticated. Run: npx tsx src/main.ts auth login');
    }

    // Check expiry with 60s buffer
    if (this.cachedToken.expires_at < Date.now() + 60_000) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh().finally(() => {
          this.refreshPromise = null;
        });
      }
      this.cachedToken = await this.refreshPromise;
    }

    return this.cachedToken;
  }

  private async doRefresh(): Promise<CodexToken> {
    const current = this.cachedToken;
    if (!current) throw new Error('No token to refresh');

    const refreshed = await refreshAccessToken(current.refresh_token, this.fetchFn);
    await this.tokenStore.save(refreshed);
    return refreshed;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
