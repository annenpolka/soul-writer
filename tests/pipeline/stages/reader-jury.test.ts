import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { ReaderJuryResult } from '../../../src/agents/types.js';

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue('evaluated'),
      completeJSON: vi.fn().mockResolvedValue({}),
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

const mockJuryResult: ReaderJuryResult = {
  evaluations: [
    {
      personaId: 'casual-reader',
      personaName: 'Casual Reader',
      categoryScores: { engagement: 0.9, clarity: 0.85, emotionalImpact: 0.95 },
      weightedScore: 0.9,
      feedback: { strengths: 'Great pacing', weaknesses: 'None', suggestion: 'Keep it up' },
    },
  ],
  aggregatedScore: 0.9,
  passed: true,
  summary: 'Well received by readers',
};

describe('createReaderJuryStage', () => {
  it('should run reader jury evaluation and set result on context', async () => {
    vi.doMock('../../../src/agents/reader-jury.js', () => ({
      createReaderJury: () => ({
        evaluate: async () => mockJuryResult,
      }),
    }));

    const { createReaderJuryStage } = await import(
      '../../../src/pipeline/stages/reader-jury.js'
    );

    const stage = createReaderJuryStage();
    const ctx = makeContext({ text: 'story text', tokensUsed: 500 });
    const result = await stage(ctx);

    expect(result.readerJuryResult).toEqual(mockJuryResult);
    expect(result.text).toBe('story text');
  });

  it('should pass correct arguments to createReaderJury', async () => {
    const capturedDeps: unknown[] = [];
    const capturedEvalArgs: unknown[] = [];

    vi.doMock('../../../src/agents/reader-jury.js', () => ({
      createReaderJury: (deps: unknown) => {
        capturedDeps.push(deps);
        return {
          evaluate: async (...args: unknown[]) => {
            capturedEvalArgs.push(...args);
            return mockJuryResult;
          },
        };
      },
    }));

    const { createReaderJuryStage } = await import(
      '../../../src/pipeline/stages/reader-jury.js'
    );

    const deps = makeDeps();
    const stage = createReaderJuryStage();
    await stage(makeContext({
      text: 'story text',
      deps,
    }));

    // createReaderJury receives deps object with llmClient, soulText
    const passedDeps = capturedDeps[0] as Record<string, unknown>;
    expect(passedDeps.llmClient).toBe(deps.llmClient);
    expect(passedDeps.soulText).toBe(deps.soulText);

    // evaluate receives: text, previousResult (undefined for first eval)
    expect(capturedEvalArgs[0]).toBe('story text');
    expect(capturedEvalArgs[1]).toBeUndefined();
  });

  it('should pass previous readerJuryResult for re-evaluation', async () => {
    const capturedEvalArgs: unknown[] = [];
    const previousResult: ReaderJuryResult = {
      evaluations: [],
      aggregatedScore: 0.6,
      passed: false,
      summary: 'Needs work',
    };

    vi.doMock('../../../src/agents/reader-jury.js', () => ({
      createReaderJury: () => ({
        evaluate: async (...args: unknown[]) => {
          capturedEvalArgs.push(...args);
          return mockJuryResult;
        },
      }),
    }));

    const { createReaderJuryStage } = await import(
      '../../../src/pipeline/stages/reader-jury.js'
    );

    const stage = createReaderJuryStage();
    await stage(makeContext({
      text: 'improved text',
      readerJuryResult: previousResult,
    }));

    expect(capturedEvalArgs[0]).toBe('improved text');
    expect(capturedEvalArgs[1]).toEqual(previousResult);
  });

  it('should preserve other context fields', async () => {
    vi.doMock('../../../src/agents/reader-jury.js', () => ({
      createReaderJury: () => ({
        evaluate: async () => mockJuryResult,
      }),
    }));

    const { createReaderJuryStage } = await import(
      '../../../src/pipeline/stages/reader-jury.js'
    );

    const stage = createReaderJuryStage();
    const ctx = makeContext({
      text: 'text',
      champion: 'writer_1',
      correctionAttempts: 2,
      synthesized: true,
      tokensUsed: 400,
    });
    const result = await stage(ctx);

    expect(result.champion).toBe('writer_1');
    expect(result.correctionAttempts).toBe(2);
    expect(result.synthesized).toBe(true);
    expect(result.tokensUsed).toBe(400);
  });
});
