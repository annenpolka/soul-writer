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

  it('execute() should use temperature 0.6', async () => {
    const deps = createMockExecutorDeps();
    const executor = createSynthesisExecutor(deps);
    await executor.execute('勝者テキスト', createMockPlan());

    const call = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    // call[2] is the options
    const options = call[2] as { temperature?: number };
    expect(options.temperature).toBe(0.6);
  });

  it('execute() should include champion text in user prompt', async () => {
    const deps = createMockExecutorDeps();
    const executor = createSynthesisExecutor(deps);
    await executor.execute('わたしの勝者テキスト本文', createMockPlan());

    const call = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    // call[1] is the user prompt
    expect(call[1]).toContain('わたしの勝者テキスト本文');
  });
});
