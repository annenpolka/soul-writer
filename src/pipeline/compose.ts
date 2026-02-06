import type { PipelineContext, PipelineStage } from './types.js';

/**
 * Compose multiple pipeline stages into a single stage.
 * Stages execute sequentially; each receives the context returned by the previous.
 */
export function pipe(...stages: PipelineStage[]): PipelineStage {
  return async (ctx: PipelineContext): Promise<PipelineContext> => {
    let current = ctx;
    for (const stage of stages) {
      current = await stage(current);
    }
    return current;
  };
}

/**
 * Conditionally execute a stage based on a predicate.
 * If the predicate returns false, the context passes through unchanged.
 */
export function when(
  predicate: (ctx: PipelineContext) => boolean,
  stage: PipelineStage,
): PipelineStage {
  return async (ctx: PipelineContext): Promise<PipelineContext> => {
    if (predicate(ctx)) {
      return stage(ctx);
    }
    return ctx;
  };
}

/**
 * Wrap a stage with error handling.
 * On error, runs the fallback stage if provided, otherwise returns the original context.
 */
export function tryStage(
  stage: PipelineStage,
  fallback?: PipelineStage,
): PipelineStage {
  return async (ctx: PipelineContext): Promise<PipelineContext> => {
    try {
      return await stage(ctx);
    } catch {
      if (fallback) {
        return fallback(ctx);
      }
      return ctx;
    }
  };
}
