import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TournamentArena } from '../../src/tournament/arena.js';
import type { LLMClient } from '../../src/llm/types.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

// Mock LLM Client
let callCount = 0;
let judgeCallCount = 0;
const mockLLMClient: LLMClient = {
  complete: vi.fn().mockImplementation(() => {
    callCount++;
    // Writers return different texts
    if (callCount <= 4) {
      return Promise.resolve(`Generated text from writer ${callCount}`);
    }
    return Promise.resolve('unused');
  }),
  completeWithTools: vi.fn().mockImplementation(() => {
    judgeCallCount++;
    const isFirstMatch = judgeCallCount <= 2;
    return Promise.resolve({
      toolCalls: [{
        id: 'tc-1',
        type: 'function',
        function: {
          name: 'submit_judgement',
          arguments: JSON.stringify({
            winner: isFirstMatch ? 'A' : 'B',
            reasoning: 'Test reasoning',
            scores: {
              A: { style: 0.8, compliance: 0.9, overall: 0.85 },
              B: { style: 0.7, compliance: 0.8, overall: 0.75 },
            },
            praised_excerpts: { A: [], B: [] },
          }),
        },
      }],
      content: null,
      tokensUsed: 50,
    });
  }),
  getTotalTokens: vi.fn().mockReturnValue(500),
};

const mockSoulText = createMockSoulText({ forbiddenWords: [] });

describe('TournamentArena', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callCount = 0;
    judgeCallCount = 0;
  });

  describe('constructor', () => {
    it('should create a tournament arena', () => {
      const arena = new TournamentArena(mockLLMClient, mockSoulText);
      expect(arena).toBeInstanceOf(TournamentArena);
    });
  });

  describe('runTournament', () => {
    it('should run a tournament with 4 writers', async () => {
      const arena = new TournamentArena(mockLLMClient, mockSoulText);
      const result = await arena.runTournament('Write a scene');

      expect(result).toBeDefined();
      expect(result.champion).toBeDefined();
      expect(result.championText).toBeDefined();
      expect(result.rounds).toHaveLength(3); // 2 semifinals + 1 final
    });

    it('should have correct tournament structure', async () => {
      const arena = new TournamentArena(mockLLMClient, mockSoulText);
      const result = await arena.runTournament('Write a scene');

      // Check rounds
      const [semi1, semi2, final] = result.rounds;
      expect(semi1.matchName).toBe('semifinal_1');
      expect(semi2.matchName).toBe('semifinal_2');
      expect(final.matchName).toBe('final');
    });

    it('should track all generated texts', async () => {
      const arena = new TournamentArena(mockLLMClient, mockSoulText);
      const result = await arena.runTournament('Write a scene');

      expect(result.allGenerations).toHaveLength(4);
      expect(result.allGenerations.map((g) => g.writerId)).toEqual([
        'writer_1',
        'writer_2',
        'writer_3',
        'writer_4',
      ]);
    });
  });
});
