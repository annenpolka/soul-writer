import type { ZodType } from 'zod';

/** Multi-turn message type */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** For assistant role: set when reasoning_format='parsed' */
  reasoning?: string;
}

/** Structured output response */
export interface StructuredResponse<T> {
  data: T;
  reasoning: string | null;
  tokensUsed: number;
}

/**
 * Options for LLM completion requests
 */
export interface CompletionOptions {
  /** Temperature for response randomness (0.0 - 1.0) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Reasoning format for reasoning models */
  reasoningFormat?: 'parsed' | 'raw' | 'hidden' | 'none';
}

/**
 * Capabilities exposed by an LLM client.
 */
export interface LLMCapabilities {
  /** Plain text completion support is required for every client. */
  text: true;
  /** Structured JSON output validated by a Zod schema. */
  structuredOutput: boolean;
  /** Function/tool calling support. */
  toolCalling: boolean;
  /** Provider can return or accept reasoning context. */
  reasoning: boolean;
}

/**
 * Runtime metadata for diagnostics and capability checks.
 */
export interface LLMClientMetadata {
  providerId: string;
  providerName: string;
  model: string;
  capabilities: LLMCapabilities;
}

/**
 * LLM Client interface for text generation
 */
export interface LLMClient {
  readonly metadata: LLMClientMetadata;

  /**
   * Generate a completion from the LLM (legacy string-based)
   */
  complete(
    systemPrompt: string,
    userPrompt: string,
    options?: CompletionOptions
  ): Promise<string>;

  /**
   * Generate a completion from the LLM (messages-based)
   */
  complete(
    messages: LLMMessage[],
    options?: CompletionOptions
  ): Promise<string>;

  /**
   * Generate a structured completion from the LLM
   */
  completeStructured<T>(
    messages: LLMMessage[],
    schema: ZodType<T>,
    options?: CompletionOptions
  ): Promise<StructuredResponse<T>>;

  /**
   * Generate a completion with tool calling support
   */
  completeWithTools?(
    systemPrompt: string,
    userPrompt: string,
    tools: ToolDefinition[],
    options?: ToolCallOptions
  ): Promise<ToolCallResponse>;

  /**
   * Get total tokens used across all requests
   */
  getTotalTokens(): number;
}

// --- Tool calling types ---

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
    strict?: boolean;
  };
  [k: string]: unknown;
}

export interface ToolCallResult {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallResponse {
  toolCalls: ToolCallResult[];
  content: string | null;
  tokensUsed: number;
  reasoning: string | null;
}

export interface ToolCallOptions extends CompletionOptions {
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'function'; function: { name: string } };
  parallelToolCalls?: boolean;
}
