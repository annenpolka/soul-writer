import type { PipelineStage } from '../types.js';

/**
 * Creates a pipeline stage that runs the RetakeLoop (Judge-based quality improvement).
 * This evaluates text quality using a Judge and retakes if below threshold.
 */
export function createJudgeRetakeStage(): PipelineStage {
  return async (ctx) => {
    const { createRetakeAgent } = await import('../../retake/retake-agent.js');
    const { createJudge } = await import('../../agents/judge.js');
    const { createRetakeLoop, DEFAULT_RETAKE_CONFIG } = await import('../../retake/retake-loop.js');

    const retakeAgent = createRetakeAgent({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
      narrativeRules: ctx.deps.narrativeRules,
      themeContext: ctx.deps.themeContext,
    });
    const judge = createJudge({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
      narrativeRules: ctx.deps.narrativeRules,
      themeContext: ctx.deps.themeContext,
    });
    const retakeLoop = createRetakeLoop({ retaker: retakeAgent, judge, config: DEFAULT_RETAKE_CONFIG });
    const result = await retakeLoop.run(ctx.text);

    if (result.improved) {
      return {
        ...ctx,
        text: result.finalText,
        tokensUsed: ctx.tokensUsed + result.totalTokensUsed,
      };
    }

    return {
      ...ctx,
      tokensUsed: ctx.tokensUsed + result.totalTokensUsed,
    };
  };
}
