import type { JudgeResult } from '../agents/judge.js';
import type { GenerationResult, Writer, Judge } from '../agents/types.js';
import type { LoggerFn } from '../logger.js';

/**
 * Result of a single match in the tournament
 */
export interface MatchResult {
  matchName: string;
  contestantA: string;
  contestantB: string;
  winner: string;
  judgeResult: JudgeResult;
}

/**
 * Complete tournament result
 */
export interface TournamentResult {
  champion: string;
  championText: string;
  rounds: MatchResult[];
  allGenerations: GenerationResult[];
  totalTokensUsed: number;
}

// =====================
// FP API
// =====================

/**
 * Dependencies for functional TournamentArena
 */
export interface TournamentArenaDeps {
  writers: Writer[];
  createJudge: () => Judge;
  tokenTracker?: { getTokens: () => number };
  logger?: LoggerFn;
}

/**
 * FP TournamentArena interface
 */
export interface Tournament {
  runTournament: (prompt: string) => Promise<TournamentResult>;
}

function getGenerationByWriterId(
  generations: GenerationResult[],
  writerId: string,
): GenerationResult {
  const generation = generations.find((g) => g.writerId === writerId);
  if (!generation) {
    throw new Error(`Generation not found for writer: ${writerId}`);
  }
  return generation;
}

/**
 * Create a functional TournamentArena from dependencies
 */
export function createTournamentArena(deps: TournamentArenaDeps): Tournament {
  const { writers, createJudge: createJudgeFn, tokenTracker, logger } = deps;

  async function runMatch(
    matchName: string,
    generationA: GenerationResult,
    generationB: GenerationResult,
  ): Promise<MatchResult> {
    const judge = createJudgeFn();
    const judgeResult = await judge.evaluate(generationA.text, generationB.text);

    const winner =
      judgeResult.winner === 'A'
        ? generationA.writerId
        : generationB.writerId;

    return { matchName, contestantA: generationA.writerId, contestantB: generationB.writerId, winner, judgeResult };
  }

  function logMatchResult(match: MatchResult): void {
    if (!logger) return;
    logger.debug(`Match ${match.matchName}: ${match.winner} wins (${match.contestantA} vs ${match.contestantB})`, {
      scores: match.judgeResult.scores,
      reasoning: match.judgeResult.reasoning,
    });
  }

  return {
    runTournament: async (prompt: string): Promise<TournamentResult> => {
      const tokensStart = tokenTracker?.getTokens() ?? 0;

      // Generate texts from all writers
      const generations = await Promise.all(
        writers.map((w) => w.generateWithMetadata(prompt)),
      );

      // Verbose: log all writer generations
      if (logger) {
        logger.section('Tournament: Writer Generations');
        for (const gen of generations) {
          logger.debug(`${gen.writerId} (${gen.text.length} chars, ${gen.tokensUsed} tokens)`, gen.text);
        }
      }

      const rounds: MatchResult[] = [];

      // Semifinal 1: Writer 1 vs Writer 2
      const semi1 = await runMatch('semifinal_1', generations[0], generations[1]);
      rounds.push(semi1);
      logMatchResult(semi1);

      // Semifinal 2: Writer 3 vs Writer 4
      const semi2 = await runMatch('semifinal_2', generations[2], generations[3]);
      rounds.push(semi2);
      logMatchResult(semi2);

      // Final: Winner of Semi1 vs Winner of Semi2
      const finalist1 = getGenerationByWriterId(generations, semi1.winner);
      const finalist2 = getGenerationByWriterId(generations, semi2.winner);
      const final = await runMatch('final', finalist1, finalist2);
      rounds.push(final);
      logMatchResult(final);

      const championGeneration = getGenerationByWriterId(generations, final.winner);

      logger?.section(`Tournament Champion: ${final.winner}`);

      return {
        champion: final.winner,
        championText: championGeneration.text,
        rounds,
        allGenerations: generations,
        totalTokensUsed: (tokenTracker?.getTokens() ?? 0) - tokensStart,
      };
    },
  };
}
