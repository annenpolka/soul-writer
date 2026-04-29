import { z, type ZodType } from 'zod';
import type {
  CompletionOptions,
  LLMClient,
  LLMClientMetadata,
  LLMMessage,
  StructuredResponse,
} from '../types.js';
import type { LLMProviderDefinition } from './types.js';

export const OPENAI_COMPATIBLE_DEFAULT_MODEL = 'gpt-4o-mini';

interface OpenAICompatibleConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  fetchFn?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
}

export class OpenAICompatibleClient implements LLMClient {
  private apiKey?: string;
  private baseUrl: string;
  private model: string;
  private fetchFn: typeof fetch;
  private totalTokens = 0;
  readonly metadata: LLMClientMetadata;

  constructor(config: OpenAICompatibleConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.model = config.model;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
    this.metadata = {
      providerId: 'openai-compatible',
      providerName: 'OpenAI Compatible',
      model: this.model,
      capabilities: {
        text: true,
        structuredOutput: true,
        toolCalling: false,
        reasoning: false,
      },
    };
  }

  async complete(
    systemPromptOrMessages: string | LLMMessage[],
    userPromptOrOptions?: string | CompletionOptions,
    options?: CompletionOptions,
  ): Promise<string> {
    const { messages, resolvedOptions } = this.resolveCompleteArgs(
      systemPromptOrMessages,
      userPromptOrOptions,
      options,
    );
    const response = await this.requestChatCompletion({
      model: this.model,
      messages,
      temperature: resolvedOptions?.temperature,
      max_tokens: resolvedOptions?.maxTokens,
      top_p: resolvedOptions?.topP,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI compatible provider');
    return content;
  }

  async completeStructured<T>(
    messages: LLMMessage[],
    schema: ZodType<T>,
    options?: CompletionOptions,
  ): Promise<StructuredResponse<T>> {
    const jsonSchema = z.toJSONSchema(schema);
    const response = await this.requestChatCompletion({
      model: this.model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: jsonSchema,
          strict: true,
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty structured response from OpenAI compatible provider');

    return {
      data: schema.parse(JSON.parse(content)),
      reasoning: null,
      tokensUsed: response.usage?.total_tokens ?? 0,
    };
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }

  private resolveCompleteArgs(
    systemPromptOrMessages: string | LLMMessage[],
    userPromptOrOptions?: string | CompletionOptions,
    options?: CompletionOptions,
  ): { messages: LLMMessage[]; resolvedOptions?: CompletionOptions } {
    if (typeof systemPromptOrMessages === 'string') {
      return {
        messages: [
          { role: 'system', content: systemPromptOrMessages },
          { role: 'user', content: userPromptOrOptions as string },
        ],
        resolvedOptions: options,
      };
    }
    return {
      messages: systemPromptOrMessages,
      resolvedOptions: userPromptOrOptions as CompletionOptions | undefined,
    };
  }

  private async requestChatCompletion(body: Record<string, unknown>): Promise<ChatCompletionResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OpenAI compatible request failed: HTTP ${response.status}: ${await response.text()}`);
    }

    const json = await response.json() as ChatCompletionResponse;
    if (json.usage?.total_tokens) {
      this.totalTokens += json.usage.total_tokens;
    }
    return json;
  }
}

export const openAICompatibleProvider: LLMProviderDefinition = {
  id: 'openai-compatible',
  displayName: 'OpenAI Compatible',
  defaultModel: OPENAI_COMPATIBLE_DEFAULT_MODEL,

  resolveConfig({ env, overrides }) {
    const baseUrl = overrides.baseUrl ?? env.OPENAI_COMPAT_BASE_URL;
    if (!baseUrl) {
      throw new Error('OPENAI_COMPAT_BASE_URL is required for openai-compatible provider');
    }

    return {
      provider: 'openai-compatible',
      model: overrides.model ?? env.OPENAI_COMPAT_MODEL ?? OPENAI_COMPATIBLE_DEFAULT_MODEL,
      apiKey: overrides.apiKey ?? env.OPENAI_COMPAT_API_KEY,
      baseUrl,
    };
  },

  async createClient(config) {
    if (!config.baseUrl) {
      throw new Error('OPENAI_COMPAT_BASE_URL is required for openai-compatible provider');
    }
    return new OpenAICompatibleClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    });
  },
};
