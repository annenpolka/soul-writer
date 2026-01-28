import type { LLMClient } from '../llm/types.js';
import { SoulTextManager } from '../soul/manager.js';
import { TournamentArena, type TournamentResult } from '../tournament/arena.js';

/**
 * Result of a pipeline generation
 */
export interface PipelineResult {
  text: string;
  champion: string;
  tournamentResult: TournamentResult;
  tokensUsed: number;
}

/**
 * Simple pipeline that runs a tournament to generate text
 */
export class SimplePipeline {
  private llmClient: LLMClient;
  private soulManager: SoulTextManager;

  constructor(llmClient: LLMClient, soulManager: SoulTextManager) {
    this.llmClient = llmClient;
    this.soulManager = soulManager;
  }

  /**
   * Generate text using tournament competition
   */
  async generate(prompt: string): Promise<PipelineResult> {
    const arena = new TournamentArena(
      this.llmClient,
      this.soulManager.getSoulText()
    );

    const tournamentResult = await arena.runTournament(prompt);

    return {
      text: tournamentResult.championText,
      champion: tournamentResult.champion,
      tournamentResult,
      tokensUsed: tournamentResult.totalTokensUsed,
    };
  }
}
