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

const DEFAULT_MAX_RETRIES = 3;

/**
 * Cerebras LLM Client implementation
 */
export class CerebrasClient implements LLMClient {
  private client: CerebrasSDK;
  private model: string;
  private totalTokens: number = 0;
  private maxRetries: number;

  constructor(config: CerebrasConfig, client?: CerebrasSDK) {
    this.client = client ?? (new Cerebras({ apiKey: config.apiKey }) as unknown as CerebrasSDK);
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: CompletionOptions
  ): Promise<string> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
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
    }

    throw new Error(`No content in LLM response after ${this.maxRetries} retries`);
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }
}
