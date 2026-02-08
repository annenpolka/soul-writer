import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCollaborationSynthesis, type CollaborationSynthesizerFn } from '../../src/synthesis/collaboration-synthesis.js';
import type { SynthesisAnalyzerDeps } from '../../src/agents/types.js';
import type { CollaborationResult } from '../../src/collaboration/types.js';
import { createMockLLMClientWithTools, createMockLLMClient } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockDeps(): SynthesisAnalyzerDeps & {
  _analyzerClient: ReturnType<typeof createMockLLMClientWithTools>;
  _executorClient: ReturnType<typeof createMockLLMClient>;
} {
  const analyzerToolResponse = {
    name: 'submit_improvement_plan',
    arguments: {
      championAssessment: 'コラボ最終テキストの合意度は高い',
      preserveElements: ['冒頭の描写', '結末の余韻'],
      actions: [
        {
          section: '展開',
          type: 'voice_refinement',
          description: '透心の声をより鮮明に',
          source: 'writer_2_feedback',
          priority: 'high',
        },
      ],
      expressionSources: [
        {
          writerId: 'writer_1',
          expressions: ['ARタグが星のように'],
          context: 'ドラフト導入部',
        },
      ],
    },
  };

  const analyzerClient = createMockLLMClientWithTools(analyzerToolResponse, 200);
  const executorClient = createMockLLMClient('改善されたコラボテキスト', 150);

  const combinedLLMClient = {
    complete: executorClient.complete,
    completeWithTools: analyzerClient.completeWithTools,
    getTotalTokens: vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(350),
  };

  return {
    llmClient: combinedLLMClient,
    soulText: createMockSoulText(),
    _analyzerClient: analyzerClient,
    _executorClient: executorClient,
  };
}

function createMockCollaborationResult(overrides?: Partial<CollaborationResult>): CollaborationResult {
  return {
    finalText: '最終テキスト: 透心は窓の外を見た。',
    rounds: [
      {
        roundNumber: 1,
        phase: 'proposal',
        actions: [
          { type: 'proposal', writerId: 'writer_1', content: '提案内容' },
        ],
        moderatorSummary: '提案フェーズ完了',
      },
      {
        roundNumber: 2,
        phase: 'discussion',
        actions: [
          {
            type: 'feedback',
            writerId: 'writer_2',
            targetWriterId: 'writer_1',
            feedback: '良い方向性',
            sentiment: 'agree',
          },
        ],
        moderatorSummary: '議論フェーズ完了',
      },
      {
        roundNumber: 3,
        phase: 'drafting',
        actions: [
          { type: 'draft', writerId: 'writer_1', section: '全体', text: '透心は窓の外を見た。' },
        ],
        moderatorSummary: 'ドラフト完了',
      },
    ],
    participants: ['writer_1', 'writer_2', 'writer_3'],
    totalTokensUsed: 400,
    consensusScore: 0.88,
    ...overrides,
  };
}

describe('createCollaborationSynthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a CollaborationSynthesizerFn with synthesize method', () => {
    const deps = createMockDeps();
    const synth = createCollaborationSynthesis(deps);
    expect(synth.synthesize).toBeInstanceOf(Function);
  });

  it('synthesize() should return SynthesisV2Result', async () => {
    const deps = createMockDeps();
    const synth = createCollaborationSynthesis(deps);
    const result = await synth.synthesize(
      '最終テキスト',
      createMockCollaborationResult(),
    );

    expect(result.synthesizedText).toBe('改善されたコラボテキスト');
    expect(result.plan).toBeDefined();
    expect(result.plan?.championAssessment).toBe('コラボ最終テキストの合意度は高い');
    expect(result.plan?.actions).toHaveLength(1);
    expect(result.totalTokensUsed).toBeGreaterThan(0);
  });

  it('synthesize() should use completeWithTools for analysis (Collab-specific)', async () => {
    const deps = createMockDeps();
    const synth = createCollaborationSynthesis(deps);
    await synth.synthesize('テキスト', createMockCollaborationResult());

    // Analyzer used completeWithTools
    expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('synthesize() should reuse SynthesisExecutor for execution pass', async () => {
    const deps = createMockDeps();
    const synth = createCollaborationSynthesis(deps);
    await synth.synthesize('テキスト', createMockCollaborationResult());

    // Executor used complete
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
  });

  it('synthesize() should use submit_improvement_plan tool with strict mode', async () => {
    const deps = createMockDeps();
    const synth = createCollaborationSynthesis(deps);
    await synth.synthesize('テキスト', createMockCollaborationResult());

    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    const tools = call[2] as Array<{ type: string; function: { name: string; strict?: boolean } }>;
    expect(tools).toHaveLength(1);
    expect(tools[0].function.name).toBe('submit_improvement_plan');
    expect(tools[0].function.strict).toBe(true);
  });

  it('synthesize() should use temperature 0.4 for analysis', async () => {
    const deps = createMockDeps();
    const synth = createCollaborationSynthesis(deps);
    await synth.synthesize('テキスト', createMockCollaborationResult());

    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = call[3] as { temperature?: number };
    expect(options.temperature).toBe(0.4);
  });
});
