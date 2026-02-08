import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSynthesisAnalyzer } from '../../src/synthesis/synthesis-analyzer.js';
import type { SynthesisAnalyzerDeps, SynthesisAnalyzerInput } from '../../src/agents/types.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockAnalyzerDeps(overrides?: {
  toolResponse?: { name: string; arguments: Record<string, unknown> };
  tokenCount?: number;
}): SynthesisAnalyzerDeps {
  const defaultToolResponse = {
    name: 'submit_improvement_plan',
    arguments: {
      championAssessment: '勝者テキストの文体が安定',
      preserveElements: ['冒頭の比喩', '内面描写'],
      actions: [
        {
          section: '展開',
          type: 'expression_upgrade',
          description: 'writer_2の比喩を取り入れ',
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
    },
  };

  return {
    llmClient: createMockLLMClientWithTools(
      overrides?.toolResponse ?? defaultToolResponse,
      overrides?.tokenCount ?? 200,
    ),
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
      { writerId: 'writer_4', text: '敗者テキスト4', tokensUsed: 100 },
    ],
    rounds: [
      {
        matchName: 'semi_1',
        contestantA: 'writer_1',
        contestantB: 'writer_2',
        winner: 'writer_1',
        judgeResult: {
          winner: 'A',
          reasoning: 'Aが優れる',
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

describe('createSynthesisAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a SynthesisAnalyzer with analyze method', () => {
    const deps = createMockAnalyzerDeps();
    const analyzer = createSynthesisAnalyzer(deps);
    expect(analyzer.analyze).toBeInstanceOf(Function);
  });

  it('analyze() should call completeWithTools', async () => {
    const deps = createMockAnalyzerDeps();
    const analyzer = createSynthesisAnalyzer(deps);
    await analyzer.analyze(createMockInput());
    expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('analyze() should return an ImprovementPlan', async () => {
    const deps = createMockAnalyzerDeps();
    const analyzer = createSynthesisAnalyzer(deps);
    const result = await analyzer.analyze(createMockInput());

    expect(result.plan).toBeDefined();
    expect(result.plan.championAssessment).toBe('勝者テキストの文体が安定');
    expect(result.plan.preserveElements).toHaveLength(2);
    expect(result.plan.actions).toHaveLength(1);
    expect(result.plan.actions[0].type).toBe('expression_upgrade');
    expect(result.plan.expressionSources).toHaveLength(1);
  });

  it('analyze() should return tokensUsed', async () => {
    const deps = createMockAnalyzerDeps({ tokenCount: 350 });
    const analyzer = createSynthesisAnalyzer(deps);
    const result = await analyzer.analyze(createMockInput());

    expect(result.tokensUsed).toBeDefined();
    expect(typeof result.tokensUsed).toBe('number');
  });

  it('analyze() should early-return empty plan when no losers (allGenerations.length <= 1)', async () => {
    const deps = createMockAnalyzerDeps();
    const analyzer = createSynthesisAnalyzer(deps);
    const input = createMockInput({
      allGenerations: [{ writerId: 'writer_1', text: '勝者テキスト', tokensUsed: 100 }],
    });

    const result = await analyzer.analyze(input);

    expect(result.plan.actions).toHaveLength(0);
    expect(result.tokensUsed).toBe(0);
    expect(deps.llmClient.completeWithTools).not.toHaveBeenCalled();
  });

  it('analyze() should use submit_improvement_plan tool with strict mode', async () => {
    const deps = createMockAnalyzerDeps();
    const analyzer = createSynthesisAnalyzer(deps);
    await analyzer.analyze(createMockInput());

    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    const tools = call[2] as Array<{ type: string; function: { name: string; strict?: boolean } }>;
    expect(tools).toHaveLength(1);
    expect(tools[0].function.name).toBe('submit_improvement_plan');
    expect(tools[0].function.strict).toBe(true);
  });

  it('analyze() should use temperature 0.4', async () => {
    const deps = createMockAnalyzerDeps();
    const analyzer = createSynthesisAnalyzer(deps);
    await analyzer.analyze(createMockInput());

    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = call[3] as { temperature?: number };
    expect(options.temperature).toBe(0.4);
  });
});
