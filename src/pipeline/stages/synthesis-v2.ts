import type { PipelineStage } from '../types.js';

export function createSynthesisV2Stage(): PipelineStage {
  return async (ctx) => {
    if (!ctx.tournamentResult) return ctx;

    const { createSynthesisV2 } = await import('../../synthesis/synthesis-v2.js');
    const synthesizer = createSynthesisV2({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
      narrativeRules: ctx.deps.narrativeRules,
      themeContext: ctx.deps.themeContext,
      macGuffinContext: ctx.deps.macGuffinContext,
    });

    const result = await synthesizer.synthesize({
      championText: ctx.text,
      championId: ctx.champion!,
      allGenerations: ctx.tournamentResult.allGenerations,
      rounds: ctx.tournamentResult.rounds,
      chapterContext: ctx.chapterContext,
    });

    return {
      ...ctx,
      text: result.synthesizedText,
      synthesized: true,
      improvementPlan: result.plan ?? undefined,
      tokensUsed: ctx.tokensUsed + result.totalTokensUsed,
    };
  };
}
