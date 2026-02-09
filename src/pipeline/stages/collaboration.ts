import type { PipelineStage } from '../types.js';
import type { CollaborationConfig } from '../../collaboration/types.js';
import type { WriterConfig } from '../../agents/types.js';

export interface CollaborationStageConfig {
  writerConfigs?: WriterConfig[];
  collaborationConfig?: Partial<CollaborationConfig>;
}

/**
 * Creates a pipeline stage that runs a collaboration session.
 * This replaces the tournament stage when in collaboration mode.
 */
export function createCollaborationStage(config: CollaborationStageConfig): PipelineStage {
  return async (ctx) => {
    const { createCollaborationSession } = await import('../../collaboration/session.js');
    const { toTournamentResult } = await import('../../collaboration/adapter.js');

    const session = createCollaborationSession({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
      writerConfigs: config.writerConfigs ?? [],
      config: config.collaborationConfig,
      themeContext: ctx.deps.themeContext,
      macGuffinContext: ctx.deps.macGuffinContext,
      enrichedCharacters: ctx.deps.enrichedCharacters,
      logger: ctx.deps.logger,
    });

    const collabResult = await session.run(ctx.prompt);
    const tournamentResult = toTournamentResult(collabResult);

    return {
      ...ctx,
      text: collabResult.finalText,
      champion: 'collaboration',
      tournamentResult,
      tokensUsed: ctx.tokensUsed + collabResult.totalTokensUsed,
    };
  };
}
