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
   * Get total tokens used across all requests
   */
  getTotalTokens(): number;
}

/**
 * Configuration for Cerebras client
 */
export interface CerebrasConfig {
  apiKey: string;
  model: string;
  /** Maximum retries for empty responses or HTTP errors (default: 5) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  initialRetryDelayMs?: number;
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelayMs?: number;
}
