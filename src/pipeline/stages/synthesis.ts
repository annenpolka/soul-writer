import type { PipelineStage } from '../types.js';

export function createSynthesisStage(): PipelineStage {
  return async (ctx) => {
    if (!ctx.tournamentResult) return ctx;

    const { createSynthesisAgent } = await import('../../synthesis/synthesis-agent.js');
    const agent = createSynthesisAgent({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
      narrativeRules: ctx.deps.narrativeRules,
      themeContext: ctx.deps.themeContext,
    });

    const result = await agent.synthesize(
      ctx.text,
      ctx.champion!,
      ctx.tournamentResult.allGenerations,
      ctx.tournamentResult.rounds,
    );

    return {
      ...ctx,
      text: result.synthesizedText,
      synthesized: true,
      tokensUsed: ctx.tokensUsed + result.tokensUsed,
    };
  };
}
