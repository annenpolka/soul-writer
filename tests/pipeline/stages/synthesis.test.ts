import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { TournamentResult } from '../../../src/tournament/arena.js';

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue('synthesized text'),
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

describe('createSynthesisStage', () => {
  it('should skip synthesis when tournamentResult is absent', async () => {
    const { createSynthesisStage } = await import(
      '../../../src/pipeline/stages/synthesis.js'
    );

    const stage = createSynthesisStage();
    const ctx = makeContext({ text: 'original text' });
    const result = await stage(ctx);

    expect(result.text).toBe('original text');
    expect(result.synthesized).toBe(false);
  });

  it('should run synthesis and update context with results', async () => {
    vi.doMock('../../../src/synthesis/synthesis-agent.js', () => ({
      createSynthesisAgent: () => ({
        synthesize: async () => ({ synthesizedText: 'synthesized champion text', tokensUsed: 200 }),
      }),
    }));

    const { createSynthesisStage } = await import(
      '../../../src/pipeline/stages/synthesis.js'
    );

    const stage = createSynthesisStage();
    const ctx = makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      tokensUsed: 100,
    });
    const result = await stage(ctx);

    expect(result.text).toBe('synthesized champion text');
    expect(result.synthesized).toBe(true);
    expect(result.tokensUsed).toBe(100 + 200);
  });

  it('should pass correct arguments to createSynthesisAgent', async () => {
    const capturedDeps: unknown[] = [];
    const capturedSynthArgs: unknown[] = [];

    vi.doMock('../../../src/synthesis/synthesis-agent.js', () => ({
      createSynthesisAgent: (deps: unknown) => {
        capturedDeps.push(deps);
        return {
          synthesize: async (...args: unknown[]) => {
            capturedSynthArgs.push(...args);
            return { synthesizedText: 'synth text', tokensUsed: 50 };
          },
        };
      },
    }));

    const { createSynthesisStage } = await import(
      '../../../src/pipeline/stages/synthesis.js'
    );

    const deps = makeDeps({
      themeContext: { emotion: 'test', timeline: 'now', premise: 'test premise' },
    });

    const stage = createSynthesisStage();
    await stage(makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      deps,
    }));

    // createSynthesisAgent receives deps object
    const passedDeps = capturedDeps[0] as Record<string, unknown>;
    expect(passedDeps.llmClient).toBe(deps.llmClient);
    expect(passedDeps.soulText).toBe(deps.soulText);
    expect(passedDeps.narrativeRules).toBe(deps.narrativeRules);
    expect(passedDeps.themeContext).toBe(deps.themeContext);

    // synthesize receives: championText, championId, allGenerations, rounds
    expect(capturedSynthArgs[0]).toBe('champion text');
    expect(capturedSynthArgs[1]).toBe('writer_1');
    expect(capturedSynthArgs[2]).toEqual(mockTournamentResult.allGenerations);
    expect(capturedSynthArgs[3]).toEqual(mockTournamentResult.rounds);
  });

  it('should preserve other context fields', async () => {
    vi.doMock('../../../src/synthesis/synthesis-agent.js', () => ({
      createSynthesisAgent: () => ({
        synthesize: async () => ({ synthesizedText: 'synth', tokensUsed: 10 }),
      }),
    }));

    const { createSynthesisStage } = await import(
      '../../../src/pipeline/stages/synthesis.js'
    );

    const stage = createSynthesisStage();
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
