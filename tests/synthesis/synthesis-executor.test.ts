import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSynthesisExecutor } from '../../src/synthesis/synthesis-executor.js';
import type { SynthesisExecutorDeps, ImprovementPlan } from '../../src/agents/types.js';
import { createMockLLMClient } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockExecutorDeps(overrides?: {
  response?: string;
  tokenCount?: number;
}): SynthesisExecutorDeps {
  return {
    llmClient: createMockLLMClient(
      overrides?.response ?? '改善されたテキスト内容',
      overrides?.tokenCount ?? 150,
    ),
    soulText: createMockSoulText(),
  };
}

function createMockPlan(overrides?: Partial<ImprovementPlan>): ImprovementPlan {
  return {
    championAssessment: '文体は安定',
    preserveElements: ['冒頭の比喩'],
    actions: [
      {
        section: '展開',
        type: 'expression_upgrade',
        description: '比喩を強化',
        source: 'writer_2',
        priority: 'high',
      },
    ],
    expressionSources: [
      {
        writerId: 'writer_2',
        expressions: ['月光が砕けた'],
        context: '情景描写',
      },
    ],
    ...overrides,
  };
}

describe('createSynthesisExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a SynthesisExecutorFn with execute method', () => {
    const deps = createMockExecutorDeps();
    const executor = createSynthesisExecutor(deps);
    expect(executor.execute).toBeInstanceOf(Function);
  });

  it('execute() should call llmClient.complete()', async () => {
    const deps = createMockExecutorDeps();
    const executor = createSynthesisExecutor(deps);
    await executor.execute('勝者テキスト', createMockPlan());
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
  });

  it('execute() should return synthesizedText', async () => {
    const deps = createMockExecutorDeps({ response: '改善テキスト' });
    const executor = createSynthesisExecutor(deps);
    const result = await executor.execute('勝者テキスト', createMockPlan());

    expect(result.synthesizedText).toBe('改善テキスト');
  });

  it('execute() should return tokensUsed', async () => {
    const deps = createMockExecutorDeps({ tokenCount: 300 });
    const executor = createSynthesisExecutor(deps);
    const result = await executor.execute('勝者テキスト', createMockPlan());

    expect(result.tokensUsed).toBeDefined();
    expect(typeof result.tokensUsed).toBe('number');
  });

  it('execute() should use temperature 1.0', async () => {
    const deps = createMockExecutorDeps();
    const executor = createSynthesisExecutor(deps);
    await executor.execute('勝者テキスト', createMockPlan());

    const call = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    // call[2] is the options
    const options = call[2] as { temperature?: number };
    expect(options.temperature).toBe(1.0);
  });

  it('execute() should include champion text in user prompt', async () => {
    const deps = createMockExecutorDeps();
    const executor = createSynthesisExecutor(deps);
    await executor.execute('わたしの勝者テキスト本文', createMockPlan());

    const call = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    // call[1] is the user prompt
    expect(call[1]).toContain('わたしの勝者テキスト本文');
  });

  describe('multi-turn: analyzer reasoning propagation', () => {
    it('execute() should use messages-based complete() with analyzer reasoning', async () => {
      const deps = createMockExecutorDeps();
      const executor = createSynthesisExecutor(deps);
      await executor.execute('勝者テキスト', createMockPlan(), 'Analyzerの推論プロセス');

      const call = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
      // When analyzerReasoning is provided, should use messages-based API
      const messages = call[0];
      expect(Array.isArray(messages)).toBe(true);
      // Messages: system + user (analyzer context) + assistant (plan + reasoning) + user (executor prompt)
      expect(messages).toHaveLength(4);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
      expect(messages[2].reasoning).toBe('Analyzerの推論プロセス');
      expect(messages[3].role).toBe('user');
    });

    it('execute() should fall back to string-based complete() without analyzer reasoning', async () => {
      const deps = createMockExecutorDeps();
      const executor = createSynthesisExecutor(deps);
      await executor.execute('勝者テキスト', createMockPlan());

      const call = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
      // Without analyzerReasoning, should use legacy string-based API
      expect(typeof call[0]).toBe('string');
    });

    it('execute() should omit reasoning field when analyzer reasoning is null', async () => {
      const deps = createMockExecutorDeps();
      const executor = createSynthesisExecutor(deps);
      await executor.execute('勝者テキスト', createMockPlan(), null);

      const call = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
      // null reasoning: should use legacy string-based API
      expect(typeof call[0]).toBe('string');
    });
  });
});
