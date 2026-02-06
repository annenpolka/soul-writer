import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWriter } from '../../src/agents/writer.js';
import type { WriterDeps, WriterConfig } from '../../src/agents/types.js';
import { createMockLLMClient, createMockThemeContext } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import { resolveNarrativeRules } from '../../src/factory/narrative-rules.js';

function createMockWriterDeps(overrides?: {
  response?: string;
  tokenCount?: number;
  config?: Partial<WriterConfig>;
}): WriterDeps {
  const tokenCount = overrides?.tokenCount ?? 100;
  let callCount = 0;
  const llmClient = createMockLLMClient(overrides?.response ?? 'generated text', tokenCount);
  // Make getTotalTokens return increasing values for metadata calculation
  (llmClient.getTotalTokens as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount++;
    return callCount === 1 ? 0 : tokenCount;
  });

  return {
    llmClient,
    soulText: createMockSoulText(),
    config: {
      id: 'test-writer',
      temperature: 0.7,
      topP: 0.9,
      style: 'balanced' as const,
      ...overrides?.config,
    },
    narrativeRules: resolveNarrativeRules(),
  };
}

describe('createWriter (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a Writer with all required methods', () => {
    const deps = createMockWriterDeps();
    const writer = createWriter(deps);
    expect(writer.generate).toBeInstanceOf(Function);
    expect(writer.generateWithMetadata).toBeInstanceOf(Function);
    expect(writer.getId).toBeInstanceOf(Function);
    expect(writer.getConfig).toBeInstanceOf(Function);
  });

  it('getId() should return config id', () => {
    const deps = createMockWriterDeps({ config: { id: 'writer_42' } });
    const writer = createWriter(deps);
    expect(writer.getId()).toBe('writer_42');
  });

  it('getConfig() should return a copy of config', () => {
    const deps = createMockWriterDeps({ config: { id: 'w1', temperature: 0.8 } });
    const writer = createWriter(deps);
    const config = writer.getConfig();
    expect(config.id).toBe('w1');
    expect(config.temperature).toBe(0.8);
  });

  it('generate() should call LLM and return text', async () => {
    const deps = createMockWriterDeps({ response: 'beautiful prose' });
    const writer = createWriter(deps);
    const result = await writer.generate('Write a scene');
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
    expect(result).toBe('beautiful prose');
  });

  it('generate() should pass temperature and topP to LLM', async () => {
    const deps = createMockWriterDeps({ config: { temperature: 0.9, topP: 0.95 } });
    const writer = createWriter(deps);
    await writer.generate('Write a scene');
    const callArgs = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[2]).toEqual(expect.objectContaining({
      temperature: 0.9,
      topP: 0.95,
    }));
  });

  it('generateWithMetadata() should return GenerationResult', async () => {
    const deps = createMockWriterDeps({
      response: 'prose text',
      tokenCount: 200,
      config: { id: 'meta-writer' },
    });
    const writer = createWriter(deps);
    const result = await writer.generateWithMetadata('Write a scene');
    expect(result.writerId).toBe('meta-writer');
    expect(result.text).toBe('prose text');
    expect(result.tokensUsed).toBe(200);
  });

  it('should work with themeContext', async () => {
    const deps = createMockWriterDeps();
    deps.themeContext = createMockThemeContext({ emotion: '渇望' });
    const writer = createWriter(deps);
    const result = await writer.generate('Write a scene');
    expect(result).toBeDefined();
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
  });

  it('should work with macGuffinContext', async () => {
    const deps = createMockWriterDeps();
    deps.macGuffinContext = {
      characterMacGuffins: [],
      plotMacGuffins: [],
    };
    const writer = createWriter(deps);
    const result = await writer.generate('Write a scene');
    expect(result).toBeDefined();
  });
});
