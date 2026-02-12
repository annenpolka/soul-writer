import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSynthesisV2 } from '../../src/synthesis/synthesis-v2.js';
import type { SynthesisAnalyzerDeps, SynthesisExecutorDeps, SynthesisAnalyzerInput } from '../../src/agents/types.js';
import type { ImprovementPlanRaw } from '../../src/schemas/improvement-plan.js';
import { createMockLLMClient } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockV2Deps(): SynthesisAnalyzerDeps & SynthesisExecutorDeps {
  const analyzerData: ImprovementPlanRaw = {
    championAssessment: '勝者テキストの文体安定',
    preserveElements: ['冒頭比喩'],
    actions: [
      {
        section: '展開',
        type: 'expression_upgrade',
        description: '表現強化',
        source: 'writer_2',
        priority: 'high',
      },
    ],
    expressionSources: [
      {
        writerId: 'writer_2',
        expressions: ['月光が砕けた'],
        context: '情景',
      },
    ],
  };

  // Combined LLM client: completeStructured for analyzer, complete for executor
  const combinedLLMClient = {
    complete: vi.fn().mockResolvedValue('改善後テキスト'),
    completeStructured: vi.fn().mockResolvedValue({
      data: analyzerData,
      reasoning: null,
      tokensUsed: 200,
    }),
    getTotalTokens: vi.fn()
      .mockReturnValueOnce(0)    // analyzer before
      .mockReturnValueOnce(200)  // analyzer after
      .mockReturnValueOnce(200)  // executor before
      .mockReturnValueOnce(350), // executor after
  };

  return {
    llmClient: combinedLLMClient,
    soulText: createMockSoulText(),
  };
}

function createMockInput(overrides?: Partial<SynthesisAnalyzerInput>): SynthesisAnalyzerInput {
  return {
    championText: '勝者テキスト',
    championId: 'writer_1',
    allGenerations: [
      { writerId: 'writer_1', text: '勝者テキスト', tokensUsed: 100 },
      { writerId: 'writer_2', text: '敗者テキスト2', tokensUsed: 100 },
      { writerId: 'writer_3', text: '敗者テキスト3', tokensUsed: 100 },
    ],
    rounds: [
      {
        matchName: 'semi_1',
        contestantA: 'writer_1',
        contestantB: 'writer_2',
        winner: 'writer_1',
        judgeResult: {
          winner: 'A',
          reasoning: 'A good',
          scores: {
            A: { style: 0.8, compliance: 0.9, overall: 0.85 },
            B: { style: 0.6, compliance: 0.7, overall: 0.65 },
          },
        },
      },
    ],
    ...overrides,
  };
}

describe('createSynthesisV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a SynthesizerV2 with synthesize method', () => {
    const deps = createMockV2Deps();
    const synth = createSynthesisV2(deps);
    expect(synth.synthesize).toBeInstanceOf(Function);
  });

  it('synthesize() should execute 2-step: analyze then execute', async () => {
    const deps = createMockV2Deps();
    const synth = createSynthesisV2(deps);
    await synth.synthesize(createMockInput());

    // Analyzer called completeStructured
    expect(deps.llmClient.completeStructured).toHaveBeenCalledTimes(1);
    // Executor called complete
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
  });

  it('synthesize() should return SynthesisV2Result with plan and text', async () => {
    const deps = createMockV2Deps();
    const synth = createSynthesisV2(deps);
    const result = await synth.synthesize(createMockInput());

    expect(result.synthesizedText).toBe('改善後テキスト');
    expect(result.plan).toBeDefined();
    expect(result.plan?.championAssessment).toBe('勝者テキストの文体安定');
    expect(result.plan?.actions).toHaveLength(1);
    expect(result.totalTokensUsed).toBeGreaterThan(0);
  });

  it('synthesize() should early-return champion text when no losers', async () => {
    const deps = createMockV2Deps();
    const synth = createSynthesisV2(deps);

    const input = createMockInput({
      allGenerations: [{ writerId: 'writer_1', text: '勝者テキスト', tokensUsed: 100 }],
    });

    const result = await synth.synthesize(input);

    expect(result.synthesizedText).toBe('勝者テキスト');
    expect(result.plan).toBeNull();
    expect(result.totalTokensUsed).toBe(0);
    expect(deps.llmClient.completeStructured).not.toHaveBeenCalled();
    expect(deps.llmClient.complete).not.toHaveBeenCalled();
  });
});
