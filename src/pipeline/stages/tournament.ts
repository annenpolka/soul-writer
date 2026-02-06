import type { PipelineStage } from '../types.js';
import type { WriterConfig } from '../../agents/types.js';

export function createTournamentStage(writerConfigs: WriterConfig[]): PipelineStage {
  return async (ctx) => {
    const { createTournamentArena } = await import('../../tournament/arena.js');
    const { createWriter } = await import('../../agents/writer.js');
    const { createJudge } = await import('../../agents/judge.js');

    const writers = writerConfigs.map((config) =>
      createWriter({
        llmClient: ctx.deps.llmClient,
        soulText: ctx.deps.soulText,
        config,
        narrativeRules: ctx.deps.narrativeRules,
        developedCharacters: ctx.deps.developedCharacters,
        themeContext: ctx.deps.themeContext,
        macGuffinContext: ctx.deps.macGuffinContext,
      })
    );

    const arena = createTournamentArena({
      writers,
      createJudge: () => createJudge({
        llmClient: ctx.deps.llmClient,
        soulText: ctx.deps.soulText,
        narrativeRules: ctx.deps.narrativeRules,
        themeContext: ctx.deps.themeContext,
      }),
      tokenTracker: { getTokens: () => ctx.deps.llmClient.getTotalTokens() },
      logger: ctx.deps.logger,
    });

    const result = await arena.runTournament(ctx.prompt);

    return {
      ...ctx,
      text: result.championText,
      champion: result.champion,
      tournamentResult: result,
      tokensUsed: ctx.tokensUsed + result.totalTokensUsed,
    };
  };
}
