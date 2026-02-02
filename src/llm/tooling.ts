import type { LLMClient, ToolCallResponse, ToolCallResult } from './types.js';

type ToolCallingClient = LLMClient & { completeWithTools: NonNullable<LLMClient['completeWithTools']> };

export function assertToolCallingClient(client: LLMClient): asserts client is ToolCallingClient {
  if (!client.completeWithTools) {
    throw new Error('LLMClient does not support tool calling');
  }
}

export function findToolCall(response: ToolCallResponse, toolName: string): ToolCallResult {
  const match = response.toolCalls.find((tc) => tc.function.name === toolName);
  if (!match) {
    throw new Error(`Missing tool call: ${toolName}`);
  }
  return match;
}

export function parseToolArguments<T>(response: ToolCallResponse, toolName: string): T {
  const match = findToolCall(response, toolName);
  return JSON.parse(match.function.arguments) as T;
}
