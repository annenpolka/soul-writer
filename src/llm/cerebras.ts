import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { LLMClient, CompletionOptions, CerebrasConfig } from './types.js';

interface CerebrasResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
  };
}

interface CerebrasSDK {
  chat: {
    completions: {
      create: (params: unknown) => Promise<CerebrasResponse>;
    };
  };
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_DELAY_MS = 30000;

/**
 * Cerebras LLM Client implementation
 */
export class CerebrasClient implements LLMClient {
  private client: CerebrasSDK;
  private model: string;
  private totalTokens: number = 0;
  private maxRetries: number;
  private initialRetryDelayMs: number;
  private maxRetryDelayMs: number;

  constructor(config: CerebrasConfig, client?: CerebrasSDK) {
    this.client = client ?? (new Cerebras({ apiKey: config.apiKey }) as unknown as CerebrasSDK);
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
        const response = (await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
        })) as CerebrasResponse;

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

  getTotalTokens(): number {
    return this.totalTokens;
  }

  private isRetryable(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      // 4xx client errors (except 429) are not retryable
      if (status >= 400 && status < 500 && status !== 429) {
        return false;
      }
    }
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
