import type { PipelineStage } from '../types.js';

export function createReaderJuryStage(): PipelineStage {
  return async (ctx) => {
    const { createReaderJury } = await import('../../agents/reader-jury.js');
    const agent = createReaderJury({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
    });

    const result = await agent.evaluate(ctx.text, ctx.readerJuryResult);

    return { ...ctx, readerJuryResult: result };
  };
}
