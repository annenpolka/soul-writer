import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { TournamentResult } from '../../../src/tournament/arena.js';
import type { SynthesisV2Result, ImprovementPlan, SynthesisAnalyzerInput } from '../../../src/agents/types.js';

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue('synthesized text'),
      getTotalTokens: vi.fn().mockReturnValue(0),
    } as unknown as PipelineDeps['llmClient'],
    soulText: {} as PipelineDeps['soulText'],
    narrativeRules: {} as PipelineDeps['narrativeRules'],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    text: '',
    prompt: 'test prompt',
    tokensUsed: 0,
    correctionAttempts: 0,
    synthesized: false,
    readerRetakeCount: 0,
    deps: makeDeps(),
    ...overrides,
  };
}

const mockTournamentResult: TournamentResult = {
  champion: 'writer_1',
  championText: 'champion text',
  rounds: [],
  allGenerations: [
    { writerId: 'writer_1', text: 'champion text', tokensUsed: 100 },
    { writerId: 'writer_2', text: 'loser text', tokensUsed: 80 },
  ],
  totalTokensUsed: 500,
};

const mockPlan: ImprovementPlan = {
  championAssessment: 'Good base',
  preserveElements: ['opening'],
  actions: [
    {
      section: 'opening',
      type: 'expression_upgrade',
      description: 'Improve opening imagery',
      source: 'writer_2',
      priority: 'high',
    },
  ],
  expressionSources: [],
};

describe('createSynthesisV2Stage', () => {
  it('should skip synthesis when tournamentResult is absent', async () => {
    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const stage = createSynthesisV2Stage();
    const ctx = makeContext({ text: 'original text' });
    const result = await stage(ctx);

    expect(result.text).toBe('original text');
    expect(result.synthesized).toBe(false);
  });

  it('should run synthesis V2 and update context with results', async () => {
    const mockResult: SynthesisV2Result = {
      synthesizedText: 'synthesized V2 text',
      plan: mockPlan,
      totalTokensUsed: 300,
    };

    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: () => ({
        synthesize: vi.fn().mockResolvedValue(mockResult),
      }),
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const stage = createSynthesisV2Stage();
    const ctx = makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      tokensUsed: 100,
    });
    const result = await stage(ctx);

    expect(result.text).toBe('synthesized V2 text');
    expect(result.synthesized).toBe(true);
    expect(result.tokensUsed).toBe(100 + 300);
    expect(result.improvementPlan).toEqual(mockPlan);
  });

  it('should pass correct deps to createSynthesisV2', async () => {
    const capturedDeps: unknown[] = [];

    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: (deps: unknown) => {
        capturedDeps.push(deps);
        return {
          synthesize: vi.fn().mockResolvedValue({
            synthesizedText: 'synth text',
            plan: null,
            totalTokensUsed: 50,
          }),
        };
      },
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const themeContext = { emotion: 'test', timeline: 'now', premise: 'test premise' };
    const macGuffinContext = { characterMacGuffins: [], plotMacGuffins: [] };
    const deps = makeDeps({ themeContext, macGuffinContext });

    const stage = createSynthesisV2Stage();
    await stage(makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      deps,
    }));

    const passedDeps = capturedDeps[0] as Record<string, unknown>;
    expect(passedDeps.llmClient).toBe(deps.llmClient);
    expect(passedDeps.soulText).toBe(deps.soulText);
    expect(passedDeps.narrativeRules).toBe(deps.narrativeRules);
    expect(passedDeps.themeContext).toBe(themeContext);
    expect(passedDeps.macGuffinContext).toBe(macGuffinContext);
  });

  it('should pass correct input to synthesize()', async () => {
    const capturedInputs: SynthesisAnalyzerInput[] = [];

    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: () => ({
        synthesize: vi.fn().mockImplementation((input: SynthesisAnalyzerInput) => {
          capturedInputs.push(input);
          return { synthesizedText: 'synth', plan: null, totalTokensUsed: 10 };
        }),
      }),
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const chapterContext = { previousChapterTexts: ['chapter 1 text'] };
    const stage = createSynthesisV2Stage();
    await stage(makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      chapterContext,
    }));

    expect(capturedInputs).toHaveLength(1);
    const input = capturedInputs[0];
    expect(input.championText).toBe('champion text');
    expect(input.championId).toBe('writer_1');
    expect(input.allGenerations).toEqual(mockTournamentResult.allGenerations);
    expect(input.rounds).toEqual(mockTournamentResult.rounds);
    expect(input.chapterContext).toEqual(chapterContext);
  });

  it('should set improvementPlan to undefined when plan is null', async () => {
    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: () => ({
        synthesize: vi.fn().mockResolvedValue({
          synthesizedText: 'synth text',
          plan: null,
          totalTokensUsed: 50,
        }),
      }),
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const stage = createSynthesisV2Stage();
    const result = await stage(makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
    }));

    expect(result.improvementPlan).toBeUndefined();
  });

  it('should preserve other context fields', async () => {
    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: () => ({
        synthesize: vi.fn().mockResolvedValue({
          synthesizedText: 'synth',
          plan: null,
          totalTokensUsed: 10,
        }),
      }),
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const stage = createSynthesisV2Stage();
    const ctx = makeContext({
      text: 'text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      correctionAttempts: 2,
      readerRetakeCount: 1,
    });
    const result = await stage(ctx);

    expect(result.correctionAttempts).toBe(2);
    expect(result.readerRetakeCount).toBe(1);
    expect(result.champion).toBe('writer_1');
  });
});
