import { describe, it, expect } from 'vitest';
import { toTournamentResult } from './adapter.js';
import type { CollaborationResult } from './types.js';

describe('toTournamentResult', () => {
  it('should convert CollaborationResult to TournamentResult', () => {
    const collabResult: CollaborationResult = {
      finalText: '完成テキスト',
      rounds: [
        {
          roundNumber: 1,
          phase: 'proposal',
          actions: [
            { type: 'proposal', writerId: 'w1', content: '提案' },
          ],
          moderatorSummary: '要約',
        },
      ],
      participants: ['w1', 'w2'],
      totalTokensUsed: 500,
      consensusScore: 0.85,
    };

    const result = toTournamentResult(collabResult);

    expect(result.champion).toBe('collaboration');
    expect(result.championText).toBe('完成テキスト');
    expect(result.totalTokensUsed).toBe(500);
    expect(result.rounds).toEqual([]);
    expect(result.allGenerations).toEqual([]);
  });
});
