import { describe, it, expect } from 'vitest';
import type { PipelineContext, PipelineDeps, PipelineStage } from './types.js';
import { pipe, when, tryStage } from './compose.js';

function makeContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    text: '',
    prompt: 'test prompt',
    tokensUsed: 0,
    correctionAttempts: 0,
    synthesized: false,
    readerRetakeCount: 0,
    deps: {} as PipelineDeps,
    ...overrides,
  };
}

describe('pipe', () => {
  it('should execute stages sequentially and propagate context', async () => {
    const stage1: PipelineStage = async (ctx) => ({ ...ctx, text: 'hello' });
    const stage2: PipelineStage = async (ctx) => ({ ...ctx, text: ctx.text + ' world' });

    const pipeline = pipe(stage1, stage2);
    const result = await pipeline(makeContext());

    expect(result.text).toBe('hello world');
  });

  it('should return context unchanged for empty stage list', async () => {
    const pipeline = pipe();
    const ctx = makeContext({ text: 'unchanged' });
    const result = await pipeline(ctx);

    expect(result.text).toBe('unchanged');
  });

  it('should pass updated context from each stage to the next', async () => {
    const stage1: PipelineStage = async (ctx) => ({ ...ctx, tokensUsed: ctx.tokensUsed + 100 });
    const stage2: PipelineStage = async (ctx) => ({ ...ctx, tokensUsed: ctx.tokensUsed + 200 });
    const stage3: PipelineStage = async (ctx) => ({ ...ctx, tokensUsed: ctx.tokensUsed + 50 });

    const pipeline = pipe(stage1, stage2, stage3);
    const result = await pipeline(makeContext());

    expect(result.tokensUsed).toBe(350);
  });
});

describe('when', () => {
  it('should execute stage when predicate is true', async () => {
    const stage: PipelineStage = async (ctx) => ({ ...ctx, text: 'executed' });
    const conditional = when(() => true, stage);

    const result = await conditional(makeContext());
    expect(result.text).toBe('executed');
  });

  it('should skip stage when predicate is false', async () => {
    const stage: PipelineStage = async (ctx) => ({ ...ctx, text: 'should not appear' });
    const conditional = when(() => false, stage);

    const result = await conditional(makeContext({ text: 'original' }));
    expect(result.text).toBe('original');
  });

  it('should pass context to predicate', async () => {
    const stage: PipelineStage = async (ctx) => ({ ...ctx, correctionAttempts: ctx.correctionAttempts + 1 });
    const conditional = when((ctx: PipelineContext) => ctx.correctionAttempts < 3, stage);

    const result1 = await conditional(makeContext({ correctionAttempts: 0 }));
    expect(result1.correctionAttempts).toBe(1);

    const result2 = await conditional(makeContext({ correctionAttempts: 3 }));
    expect(result2.correctionAttempts).toBe(3);
  });
});

describe('tryStage', () => {
  it('should execute stage normally when no error', async () => {
    const stage: PipelineStage = async (ctx) => ({ ...ctx, text: 'success' });
    const safe = tryStage(stage);

    const result = await safe(makeContext());
    expect(result.text).toBe('success');
  });

  it('should use fallback when stage throws', async () => {
    const failStage: PipelineStage = async () => { throw new Error('boom'); };
    const fallback: PipelineStage = async (ctx) => ({ ...ctx, text: 'recovered' });
    const safe = tryStage(failStage, fallback);

    const result = await safe(makeContext());
    expect(result.text).toBe('recovered');
  });

  it('should return original context when stage throws and no fallback', async () => {
    const failStage: PipelineStage = async () => { throw new Error('boom'); };
    const safe = tryStage(failStage);

    const ctx = makeContext({ text: 'preserved' });
    const result = await safe(ctx);
    expect(result.text).toBe('preserved');
  });
});
