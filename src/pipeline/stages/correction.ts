import type { PipelineStage } from '../types.js';

export function createCorrectionStage(maxAttempts: number = 3): PipelineStage {
  return async (ctx) => {
    if (!ctx.complianceResult || ctx.complianceResult.isCompliant) {
      return ctx;
    }

    const { createCorrectionLoop } = await import('../../correction/loop.js');
    const { createCorrector } = await import('../../agents/corrector.js');
    const { createCheckerFromSoulText } = await import('../../compliance/checker.js');

    const corrector = createCorrector({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
      themeContext: ctx.deps.themeContext,
    });

    const checker = createCheckerFromSoulText(
      ctx.deps.soulText,
      ctx.deps.narrativeRules,
    );

    const loop = createCorrectionLoop({ corrector, checker, maxAttempts });
    const result = await loop.run(ctx.text, ctx.complianceResult.violations, ctx.chapterContext);

    return {
      ...ctx,
      text: result.finalText,
      correctionAttempts: result.attempts,
      tokensUsed: ctx.tokensUsed + result.totalTokensUsed,
    };
  };
}
