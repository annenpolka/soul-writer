import { vi } from 'vitest';
import type { LLMClient, StructuredResponse } from '../../src/llm/types.js';
import type { AgentDeps, CorrectorDeps, WriterDeps, ThemeContext } from '../../src/agents/types.js';
import { createMockSoulText } from './mock-soul-text.js';

/**
 * Creates a mock LLMClient for FP agent tests.
 * Each call returns a fresh mock with the given response.
 */
export function createMockLLMClient(response: string = 'mock response', tokenCount: number = 100): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue(response),
    completeStructured: vi.fn().mockResolvedValue({
      data: {},
      reasoning: null,
      tokensUsed: tokenCount,
    } satisfies StructuredResponse<unknown>),
    getTotalTokens: vi.fn().mockReturnValue(tokenCount),
  };
}

/**
 * Creates a mock LLMClient with tool-calling support.
 */
export function createMockLLMClientWithTools(
  toolResponse: { name: string; arguments: Record<string, unknown> },
  tokenCount: number = 100,
): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue(''),
    completeWithTools: vi.fn().mockResolvedValue({
      toolCalls: [
        {
          id: 'mock-tool-call-1',
          type: 'function' as const,
          function: {
            name: toolResponse.name,
            arguments: JSON.stringify(toolResponse.arguments),
          },
        },
      ],
      content: null,
      tokensUsed: tokenCount,
      reasoning: null,
    }),
    completeStructured: vi.fn().mockResolvedValue({
      data: {},
      reasoning: null,
      tokensUsed: tokenCount,
    } satisfies StructuredResponse<unknown>),
    getTotalTokens: vi.fn().mockReturnValue(tokenCount),
  };
}

/**
 * Creates a mock LLMClient with structured output support.
 */
export function createMockLLMClientWithStructured<T>(
  data: T,
  options?: { reasoning?: string | null; tokenCount?: number },
): LLMClient {
  const tokenCount = options?.tokenCount ?? 100;
  return {
    complete: vi.fn().mockResolvedValue(''),
    completeStructured: vi.fn().mockResolvedValue({
      data,
      reasoning: options?.reasoning ?? null,
      tokensUsed: tokenCount,
    } satisfies StructuredResponse<T>),
    getTotalTokens: vi.fn().mockReturnValue(tokenCount),
  };
}

/**
 * Creates base AgentDeps for FP agent tests.
 */
export function createMockAgentDeps(overrides?: {
  response?: string;
  tokenCount?: number;
}): AgentDeps {
  return {
    llmClient: createMockLLMClient(overrides?.response, overrides?.tokenCount),
    soulText: createMockSoulText(),
  };
}

/**
 * Creates CorrectorDeps for FP corrector tests.
 */
export function createMockCorrectorDeps(overrides?: {
  response?: string;
  tokenCount?: number;
  themeContext?: ThemeContext;
}): CorrectorDeps {
  return {
    ...createMockAgentDeps(overrides),
    themeContext: overrides?.themeContext,
  };
}

/**
 * Creates a mock ThemeContext.
 */
export function createMockThemeContext(overrides?: Partial<ThemeContext>): ThemeContext {
  return {
    emotion: '孤独',
    timeline: '出会い前',
    premise: 'テスト前提',
    tone: '冷徹',
    ...overrides,
  };
}
