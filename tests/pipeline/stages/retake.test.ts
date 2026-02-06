import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { ReaderJuryResult } from '../../../src/agents/types.js';

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue('retaken text'),
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

const passedJuryResult: ReaderJuryResult = {
  evaluations: [],
  aggregatedScore: 0.9,
  passed: true,
  summary: 'All good',
};

const failedJuryResult: ReaderJuryResult = {
  evaluations: [],
  aggregatedScore: 0.6,
  passed: false,
  summary: 'Needs improvement in pacing and character voice',
};

describe('createRetakeStage', () => {
  it('should skip retake when readerJuryResult is absent', async () => {
    const { createRetakeStage } = await import(
      '../../../src/pipeline/stages/retake.js'
    );

    const stage = createRetakeStage();
    const ctx = makeContext({ text: 'original text' });
    const result = await stage(ctx);

    expect(result.text).toBe('original text');
    expect(result.readerRetakeCount).toBe(0);
  });

  it('should skip retake when readerJuryResult passed', async () => {
    const { createRetakeStage } = await import(
      '../../../src/pipeline/stages/retake.js'
    );

    const stage = createRetakeStage();
    const ctx = makeContext({
      text: 'good text',
      readerJuryResult: passedJuryResult,
    });
    const result = await stage(ctx);

    expect(result.text).toBe('good text');
    expect(result.readerRetakeCount).toBe(0);
  });

  it('should run retake when readerJuryResult failed', async () => {
    vi.doMock('../../../src/retake/retake-agent.js', () => ({
      createRetakeAgent: () => ({
        retake: async () => ({ retakenText: 'improved text', tokensUsed: 300 }),
      }),
    }));

    const { createRetakeStage } = await import(
      '../../../src/pipeline/stages/retake.js'
    );

    const stage = createRetakeStage();
    const ctx = makeContext({
      text: 'poor text',
      readerJuryResult: failedJuryResult,
      tokensUsed: 100,
      readerRetakeCount: 0,
    });
    const result = await stage(ctx);

    expect(result.text).toBe('improved text');
    expect(result.readerRetakeCount).toBe(1);
    expect(result.tokensUsed).toBe(100 + 300);
  });

  it('should pass correct arguments to createRetakeAgent', async () => {
    const capturedDeps: unknown[] = [];
    const capturedRetakeArgs: unknown[] = [];

    vi.doMock('../../../src/retake/retake-agent.js', () => ({
      createRetakeAgent: (deps: unknown) => {
        capturedDeps.push(deps);
        return {
          retake: async (...args: unknown[]) => {
            capturedRetakeArgs.push(...args);
            return { retakenText: 'improved', tokensUsed: 50 };
          },
        };
      },
    }));

    const { createRetakeStage } = await import(
      '../../../src/pipeline/stages/retake.js'
    );

    const deps = makeDeps({
      themeContext: { emotion: 'test', timeline: 'now', premise: 'test premise' },
    });

    const stage = createRetakeStage();
    await stage(makeContext({
      text: 'poor text',
      readerJuryResult: failedJuryResult,
      deps,
    }));

    // createRetakeAgent receives deps object
    const passedDeps = capturedDeps[0] as Record<string, unknown>;
    expect(passedDeps.llmClient).toBe(deps.llmClient);
    expect(passedDeps.soulText).toBe(deps.soulText);
    expect(passedDeps.narrativeRules).toBe(deps.narrativeRules);
    expect(passedDeps.themeContext).toBe(deps.themeContext);

    // retake receives: text, summary (feedback)
    expect(capturedRetakeArgs[0]).toBe('poor text');
    expect(capturedRetakeArgs[1]).toBe(failedJuryResult.summary);
  });

  it('should increment readerRetakeCount from existing value', async () => {
    vi.doMock('../../../src/retake/retake-agent.js', () => ({
      createRetakeAgent: () => ({
        retake: async () => ({ retakenText: 'improved again', tokensUsed: 100 }),
      }),
    }));

    const { createRetakeStage } = await import(
      '../../../src/pipeline/stages/retake.js'
    );

    const stage = createRetakeStage();
    const ctx = makeContext({
      text: 'still poor',
      readerJuryResult: failedJuryResult,
      readerRetakeCount: 1,
    });
    const result = await stage(ctx);

    expect(result.readerRetakeCount).toBe(2);
  });

  it('should preserve other context fields', async () => {
    vi.doMock('../../../src/retake/retake-agent.js', () => ({
      createRetakeAgent: () => ({
        retake: async () => ({ retakenText: 'improved', tokensUsed: 50 }),
      }),
    }));

    const { createRetakeStage } = await import(
      '../../../src/pipeline/stages/retake.js'
    );

    const stage = createRetakeStage();
    const ctx = makeContext({
      text: 'text',
      champion: 'writer_1',
      correctionAttempts: 3,
      synthesized: true,
      readerJuryResult: failedJuryResult,
    });
    const result = await stage(ctx);

    expect(result.champion).toBe('writer_1');
    expect(result.correctionAttempts).toBe(3);
    expect(result.synthesized).toBe(true);
  });
});
