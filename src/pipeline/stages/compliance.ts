import type { PipelineStage } from '../types.js';

export function createComplianceStage(): PipelineStage {
  return async (ctx) => {
    const { createCheckerFromSoulText } = await import('../../compliance/checker.js');

    if (ctx.chapterContext) {
      const checker = createCheckerFromSoulText(
        ctx.deps.soulText, ctx.deps.narrativeRules, ctx.deps.llmClient
      );
      const result = await checker.checkWithContext(ctx.text, ctx.chapterContext);
      return { ...ctx, complianceResult: result };
    }

    const checker = createCheckerFromSoulText(ctx.deps.soulText, ctx.deps.narrativeRules);
    const result = checker.check(ctx.text);
    return { ...ctx, complianceResult: result };
  };
}
