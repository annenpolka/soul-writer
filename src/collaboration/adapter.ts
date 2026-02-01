import type { TournamentResult } from '../tournament/arena.js';
import type { CollaborationResult } from './types.js';

export function toTournamentResult(result: CollaborationResult): TournamentResult {
  return {
    champion: 'collaboration',
    championText: result.finalText,
    rounds: [],
    allGenerations: [],
    totalTokensUsed: result.totalTokensUsed,
  };
}
