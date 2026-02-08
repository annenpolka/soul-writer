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

    const logger = ctx.deps.logger;
    if (logger && result.plan) {
      logger.section('Synthesis V2 Analysis');
      logger.debug('Champion assessment', result.plan.championAssessment);
      logger.debug('Preserve elements', result.plan.preserveElements);
      logger.debug('Actions', result.plan.actions.map(a =>
        `[${a.priority}] ${a.type}: ${a.description} (source: ${a.source})`
      ));
      if (result.plan.structuralChanges?.length) {
        logger.debug('Structural changes', result.plan.structuralChanges);
      }
      logger.debug('Expression sources', result.plan.expressionSources.map(e =>
        `${e.writerId}: ${e.expressions.length} expressions`
      ));
      const charDiff = result.synthesizedText.length - ctx.text.length;
      const pctDiff = ((charDiff / ctx.text.length) * 100).toFixed(1);
      logger.debug('Text change', `${charDiff > 0 ? '+' : ''}${charDiff} chars (${pctDiff}%)`);
    }

    return {
      ...ctx,
      text: result.synthesizedText,
      synthesized: true,
      improvementPlan: result.plan ?? undefined,
      tokensUsed: ctx.tokensUsed + result.totalTokensUsed,
    };
  };
}
