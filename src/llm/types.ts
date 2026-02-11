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
}

/**
 * LLM Client interface for text generation
 */
export interface LLMClient {
  /**
   * Generate a completion from the LLM
   * @param systemPrompt - System prompt to set context
   * @param userPrompt - User prompt to respond to
   * @param options - Optional completion parameters
   * @returns Generated text response
   */
  complete(
    systemPrompt: string,
    userPrompt: string,
    options?: CompletionOptions
  ): Promise<string>;

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
}

export interface ToolCallOptions extends CompletionOptions {
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'function'; function: { name: string } };
  parallelToolCalls?: boolean;
}

/**
 * Configuration for Cerebras client
 */
export interface CerebrasConfig {
  apiKey: string;
  model: string;
  /** Maximum app-level retries for empty responses or transient errors (default: 5). SDK handles its own retries separately. */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  initialRetryDelayMs?: number;
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelayMs?: number;
}
