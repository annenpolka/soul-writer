import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { TournamentResult } from '../../../src/tournament/arena.js';
import type { WriterConfig } from '../../../src/agents/types.js';

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue('generated text'),
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
  championText: 'winning text from tournament',
  rounds: [],
  allGenerations: [
    { writerId: 'writer_1', text: 'winning text from tournament', tokensUsed: 100 },
    { writerId: 'writer_2', text: 'other text', tokensUsed: 80 },
  ],
  totalTokensUsed: 500,
};

describe('createTournamentStage', () => {
  it('should run tournament and update context with results', async () => {
    // Mock TournamentArena
    vi.doMock('../../../src/tournament/arena.js', () => ({
      createTournamentArena: () => ({
        runTournament: async () => mockTournamentResult,
      }),
    }));
    vi.doMock('../../../src/agents/writer.js', () => ({
      createWriter: () => ({ generate: async () => 'text' }),
    }));
    vi.doMock('../../../src/agents/judge.js', () => ({
      createJudge: () => ({ evaluate: async () => ({}) }),
    }));

    const { createTournamentStage } = await import(
      '../../../src/pipeline/stages/tournament.js'
    );

    const writerConfigs: WriterConfig[] = [
      { id: 'writer_1', temperature: 1.0, topP: 0.9, style: 'balanced' },
      { id: 'writer_2', temperature: 1.0, topP: 0.95, style: 'creative' },
      { id: 'writer_3', temperature: 1.0, topP: 0.8, style: 'conservative' },
      { id: 'writer_4', temperature: 1.0, topP: 0.85, style: 'moderate' },
    ];

    const stage = createTournamentStage(writerConfigs);
    const ctx = makeContext({ tokensUsed: 100 });
    const result = await stage(ctx);

    expect(result.text).toBe('winning text from tournament');
    expect(result.champion).toBe('writer_1');
    expect(result.tournamentResult).toEqual(mockTournamentResult);
    expect(result.tokensUsed).toBe(100 + 500);
  });

  it('should preserve other context fields', async () => {
    vi.doMock('../../../src/tournament/arena.js', () => ({
      createTournamentArena: () => ({
        runTournament: async () => mockTournamentResult,
      }),
    }));
    vi.doMock('../../../src/agents/writer.js', () => ({
      createWriter: () => ({ generate: async () => 'text' }),
    }));
    vi.doMock('../../../src/agents/judge.js', () => ({
      createJudge: () => ({ evaluate: async () => ({}) }),
    }));

    const { createTournamentStage } = await import(
      '../../../src/pipeline/stages/tournament.js'
    );

    const writerConfigs: WriterConfig[] = [
      { id: 'w1', temperature: 1.0, topP: 0.9, style: 'balanced' },
      { id: 'w2', temperature: 1.0, topP: 0.95, style: 'creative' },
      { id: 'w3', temperature: 1.0, topP: 0.8, style: 'conservative' },
      { id: 'w4', temperature: 1.0, topP: 0.85, style: 'moderate' },
    ];

    const stage = createTournamentStage(writerConfigs);
    const ctx = makeContext({
      prompt: 'my prompt',
      correctionAttempts: 2,
      synthesized: true,
    });
    const result = await stage(ctx);

    expect(result.prompt).toBe('my prompt');
    expect(result.correctionAttempts).toBe(2);
    expect(result.synthesized).toBe(true);
  });

  it('should pass deps to createTournamentArena', async () => {
    const capturedDeps: unknown[] = [];

    vi.doMock('../../../src/tournament/arena.js', () => ({
      createTournamentArena: (deps: unknown) => {
        capturedDeps.push(deps);
        return { runTournament: async () => mockTournamentResult };
      },
    }));
    vi.doMock('../../../src/agents/writer.js', () => ({
      createWriter: () => ({ generate: async () => 'text' }),
    }));
    vi.doMock('../../../src/agents/judge.js', () => ({
      createJudge: () => ({ evaluate: async () => ({}) }),
    }));

    const { createTournamentStage } = await import(
      '../../../src/pipeline/stages/tournament.js'
    );

    const deps = makeDeps({
      themeContext: { emotion: 'test', timeline: 'now', premise: 'test premise' },
      macGuffinContext: { characterMacGuffins: [], plotMacGuffins: [] },
    });

    const writerConfigs: WriterConfig[] = [
      { id: 'w1', temperature: 1.0, topP: 0.9, style: 'balanced' },
      { id: 'w2', temperature: 1.0, topP: 0.95, style: 'creative' },
      { id: 'w3', temperature: 1.0, topP: 0.8, style: 'conservative' },
      { id: 'w4', temperature: 1.0, topP: 0.85, style: 'moderate' },
    ];

    const stage = createTournamentStage(writerConfigs);
    await stage(makeContext({ deps }));

    // createTournamentArena receives deps object with writers, createJudge, etc.
    const passedDeps = capturedDeps[0] as Record<string, unknown>;
    expect(passedDeps.writers).toBeDefined();
    expect(Array.isArray(passedDeps.writers)).toBe(true);
    expect(typeof passedDeps.createJudge).toBe('function');
  });

  it('should pass prompt from context to runTournament', async () => {
    let capturedPrompt = '';

    vi.doMock('../../../src/tournament/arena.js', () => ({
      createTournamentArena: () => ({
        runTournament: async (prompt: string) => {
          capturedPrompt = prompt;
          return mockTournamentResult;
        },
      }),
    }));
    vi.doMock('../../../src/agents/writer.js', () => ({
      createWriter: () => ({ generate: async () => 'text' }),
    }));
    vi.doMock('../../../src/agents/judge.js', () => ({
      createJudge: () => ({ evaluate: async () => ({}) }),
    }));

    const { createTournamentStage } = await import(
      '../../../src/pipeline/stages/tournament.js'
    );

    const writerConfigs: WriterConfig[] = [
      { id: 'w1', temperature: 1.0, topP: 0.9, style: 'balanced' },
      { id: 'w2', temperature: 1.0, topP: 0.95, style: 'creative' },
      { id: 'w3', temperature: 1.0, topP: 0.8, style: 'conservative' },
      { id: 'w4', temperature: 1.0, topP: 0.85, style: 'moderate' },
    ];

    const stage = createTournamentStage(writerConfigs);
    await stage(makeContext({ prompt: 'specific prompt' }));

    expect(capturedPrompt).toBe('specific prompt');
  });
});
