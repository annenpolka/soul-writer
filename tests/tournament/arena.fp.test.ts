import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTournamentArena } from '../../src/tournament/arena.js';
import type { Writer, Judge, GenerationResult, JudgeResult } from '../../src/agents/types.js';
import type { Logger } from '../../src/logger.js';

function createMockWriter(id: string, text: string): Writer {
  return {
    generate: vi.fn().mockResolvedValue(text),
    generateWithMetadata: vi.fn().mockResolvedValue({
      writerId: id,
      text,
      tokensUsed: 100,
    } satisfies GenerationResult),
    getId: vi.fn().mockReturnValue(id),
    getConfig: vi.fn().mockReturnValue({
      id,
      temperature: 0.7,
      topP: 0.9,
      style: 'balanced' as const,
    }),
  };
}

function createMockJudge(winnerSequence: ('A' | 'B')[]): Judge {
  let callIndex = 0;
  return {
    evaluate: vi.fn().mockImplementation(async (): Promise<JudgeResult> => {
      const winner = winnerSequence[callIndex] ?? 'A';
      callIndex++;
      return {
        winner,
        reasoning: `Test reasoning ${callIndex}`,
        scores: {
          A: { style: 0.8, compliance: 0.9, overall: 0.85 },
          B: { style: 0.7, compliance: 0.8, overall: 0.75 },
        },
        praised_excerpts: { A: [], B: [] },
      };
    }),
  };
}

describe('createTournamentArena (FP)', () => {
  it('should return an object with runTournament method', () => {
    const writers = [
      createMockWriter('w1', 'text1'),
      createMockWriter('w2', 'text2'),
      createMockWriter('w3', 'text3'),
      createMockWriter('w4', 'text4'),
    ];
    const judge = createMockJudge(['A', 'A', 'A']);

    const arena = createTournamentArena({ writers, createJudge: () => judge });

    expect(arena).toBeDefined();
    expect(typeof arena.runTournament).toBe('function');
  });

  it('should run a full tournament with 4 writers', async () => {
    const writers = [
      createMockWriter('w1', 'text1'),
      createMockWriter('w2', 'text2'),
      createMockWriter('w3', 'text3'),
      createMockWriter('w4', 'text4'),
    ];
    const judge = createMockJudge(['A', 'B', 'A']);

    const arena = createTournamentArena({ writers, createJudge: () => judge });
    const result = await arena.runTournament('Write a scene');

    expect(result).toBeDefined();
    expect(result.champion).toBeDefined();
    expect(result.championText).toBeDefined();
    expect(result.rounds).toHaveLength(3);
    expect(result.allGenerations).toHaveLength(4);
  });

  it('should have correct tournament bracket structure', async () => {
    const writers = [
      createMockWriter('w1', 'text1'),
      createMockWriter('w2', 'text2'),
      createMockWriter('w3', 'text3'),
      createMockWriter('w4', 'text4'),
    ];
    const judge = createMockJudge(['A', 'A', 'A']);

    const arena = createTournamentArena({ writers, createJudge: () => judge });
    const result = await arena.runTournament('Write a scene');

    const [semi1, semi2, final] = result.rounds;
    expect(semi1.matchName).toBe('semifinal_1');
    expect(semi2.matchName).toBe('semifinal_2');
    expect(final.matchName).toBe('final');
  });

  it('should correctly determine winner based on judge results', async () => {
    const writers = [
      createMockWriter('w1', 'text1'),
      createMockWriter('w2', 'text2'),
      createMockWriter('w3', 'text3'),
      createMockWriter('w4', 'text4'),
    ];
    // semi1: B wins (w2), semi2: A wins (w3), final: B wins (w3)
    const judge = createMockJudge(['B', 'A', 'B']);

    const arena = createTournamentArena({ writers, createJudge: () => judge });
    const result = await arena.runTournament('Write a scene');

    expect(result.champion).toBe('w3');
    expect(result.championText).toBe('text3');
  });

  it('should call generateWithMetadata on all writers', async () => {
    const writers = [
      createMockWriter('w1', 'text1'),
      createMockWriter('w2', 'text2'),
      createMockWriter('w3', 'text3'),
      createMockWriter('w4', 'text4'),
    ];
    const judge = createMockJudge(['A', 'A', 'A']);

    const arena = createTournamentArena({ writers, createJudge: () => judge });
    await arena.runTournament('Write a scene');

    for (const w of writers) {
      expect(w.generateWithMetadata).toHaveBeenCalledWith('Write a scene');
    }
  });

  it('should call createJudge for each match (3 times)', async () => {
    const writers = [
      createMockWriter('w1', 'text1'),
      createMockWriter('w2', 'text2'),
      createMockWriter('w3', 'text3'),
      createMockWriter('w4', 'text4'),
    ];
    const createJudgeFn = vi.fn().mockReturnValue(createMockJudge(['A']));

    const arena = createTournamentArena({ writers, createJudge: createJudgeFn });
    await arena.runTournament('Write a scene');

    expect(createJudgeFn).toHaveBeenCalledTimes(3);
  });

  it('should pass logger to tournament for verbose output', async () => {
    const writers = [
      createMockWriter('w1', 'text1'),
      createMockWriter('w2', 'text2'),
      createMockWriter('w3', 'text3'),
      createMockWriter('w4', 'text4'),
    ];
    const judge = createMockJudge(['A', 'A', 'A']);
    const mockLogger: Logger = {
      section: vi.fn(),
      debug: vi.fn(),
    };

    const arena = createTournamentArena({
      writers,
      createJudge: () => judge,
      logger: mockLogger,
    });
    await arena.runTournament('Write a scene');

    expect(mockLogger.section).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should calculate totalTokensUsed from tokenTracker', async () => {
    const writers = [
      createMockWriter('w1', 'text1'),
      createMockWriter('w2', 'text2'),
      createMockWriter('w3', 'text3'),
      createMockWriter('w4', 'text4'),
    ];
    const judge = createMockJudge(['A', 'A', 'A']);
    const tokenTracker = { getTokens: vi.fn().mockReturnValue(500) };

    const arena = createTournamentArena({
      writers,
      createJudge: () => judge,
      tokenTracker,
    });
    const result = await arena.runTournament('Write a scene');

    // Called twice: start and end
    expect(tokenTracker.getTokens).toHaveBeenCalledTimes(2);
    expect(result.totalTokensUsed).toBe(0); // 500 - 500 = 0
  });
});
