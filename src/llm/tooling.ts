import type { LLMClient, ToolCallResponse, ToolCallResult } from './types.js';

type ToolCallingClient = LLMClient & { completeWithTools: NonNullable<LLMClient['completeWithTools']> };

type CapabilityName = keyof LLMClient['metadata']['capabilities'];

export function assertToolCallingClient(client: LLMClient): asserts client is ToolCallingClient {
  requireLLMCapability(client, 'toolCalling');
  if (!client.completeWithTools) throw new Error(formatCapabilityError(client, 'toolCalling'));
}

export function requireLLMCapability(client: LLMClient, capability: CapabilityName): void {
  if (!client.metadata.capabilities[capability]) {
    throw new Error(formatCapabilityError(client, capability));
  }
}

function formatCapabilityError(client: LLMClient, capability: CapabilityName): string {
  const meta = client.metadata;
  return `LLMClient provider "${meta.providerId}" model "${meta.model}" does not support ${capability}`;
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
