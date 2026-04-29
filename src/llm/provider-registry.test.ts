import { describe, expect, it, vi } from 'vitest';
import type { LLMClient } from './types.js';
import { createLLMProviderRegistry, type LLMProviderDefinition } from './providers/index.js';

function createMockClient(): LLMClient {
  return {
    metadata: {
      providerId: 'mock',
      providerName: 'Mock Provider',
      model: 'mock-model',
      capabilities: {
        text: true,
        structuredOutput: true,
        toolCalling: false,
        reasoning: false,
      },
    },
    complete: vi.fn().mockResolvedValue('ok'),
    completeStructured: vi.fn().mockResolvedValue({ data: {}, reasoning: null, tokensUsed: 0 }),
    getTotalTokens: vi.fn().mockReturnValue(0),
  };
}

function createDefinition(id: string): LLMProviderDefinition {
  return {
    id,
    displayName: `Provider ${id}`,
    defaultModel: 'mock-model',
    resolveConfig: () => ({ provider: id, model: 'mock-model' }),
    createClient: vi.fn(async () => createMockClient()),
  };
}

describe('LLM provider registry', () => {
  it('登録済みproviderを名前で取得できる', () => {
    const definition = createDefinition('mock');
    const registry = createLLMProviderRegistry([definition]);

    expect(registry.get('mock')).toBe(definition);
    expect(registry.list()).toEqual([definition]);
  });

  it('同じ名前の二重登録を拒否する', () => {
    const registry = createLLMProviderRegistry([createDefinition('mock')]);

    expect(() => registry.register(createDefinition('mock')))
      .toThrow('LLM provider "mock" is already registered');
  });

  it('未登録providerのエラーに利用可能provider名を含める', () => {
    const registry = createLLMProviderRegistry([
      createDefinition('alpha'),
      createDefinition('beta'),
    ]);

    expect(() => registry.get('gamma'))
      .toThrow('Unknown LLM provider: gamma. Available providers: alpha, beta');
  });
});
