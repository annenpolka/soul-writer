import { describe, it, expect, vi } from 'vitest';
import { createLLMClient, type LLMProvider } from './provider-factory.js';

// Mock the modules to avoid real instantiation
vi.mock('./cerebras.js', () => ({
  CerebrasClient: class MockCerebrasClient {
    constructor(public config: unknown) {}
    async complete() { return 'cerebras'; }
    getTotalTokens() { return 0; }
  },
}));

vi.mock('./codex/codex-client.js', () => ({
  CodexClient: class MockCodexClient {
    constructor(public config: unknown) {}
    async complete() { return 'codex'; }
    getTotalTokens() { return 0; }
  },
}));

vi.mock('./codex/token-store.js', () => ({
  createFileTokenStore: () => ({
    load: async () => null,
    save: async () => {},
    clear: async () => {},
  }),
}));

describe('createLLMClient', () => {
  it("provider='cerebras'でCerebrasClientを返す", async () => {
    const client = await createLLMClient({
      provider: 'cerebras',
      cerebrasApiKey: 'test-key',
      cerebrasModel: 'test-model',
    });

    const result = await client.complete('sys', 'user');
    expect(result).toBe('cerebras');
  });

  it("provider='codex'でCodexClientを返す", async () => {
    const client = await createLLMClient({
      provider: 'codex',
      codexModel: 'gpt-5.2',
      codexReasoningEffort: 'high',
    });

    const result = await client.complete('sys', 'user');
    expect(result).toBe('codex');
    expect(((client as unknown) as { config: { reasoningEffort: string } }).config.reasoningEffort).toBe('high');
  });

  it('cerebrasでAPIキー未設定時にエラー', async () => {
    await expect(createLLMClient({
      provider: 'cerebras',
      // no cerebrasApiKey
    })).rejects.toThrow('CEREBRAS_API_KEY');
  });

  it('不明なproviderでエラー', async () => {
    await expect(createLLMClient({
      provider: 'unknown' as LLMProvider,
    })).rejects.toThrow('Unknown LLM provider');
  });
});
