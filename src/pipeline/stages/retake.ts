import type { PipelineStage } from '../types.js';

export function createRetakeStage(): PipelineStage {
  return async (ctx) => {
    if (!ctx.readerJuryResult || ctx.readerJuryResult.passed) return ctx;

    const { createRetakeAgent } = await import('../../retake/retake-agent.js');
    const agent = createRetakeAgent({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
      narrativeRules: ctx.deps.narrativeRules,
      themeContext: ctx.deps.themeContext,
    });

    const result = await agent.retake(ctx.text, ctx.readerJuryResult.summary);

    return {
      ...ctx,
      text: result.retakenText,
      readerRetakeCount: ctx.readerRetakeCount + 1,
      tokensUsed: ctx.tokensUsed + result.tokensUsed,
    };
  };
}
