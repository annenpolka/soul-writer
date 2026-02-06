import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { ComplianceResult } from '../../../src/agents/types.js';
import type { ChapterContext } from '../../../src/agents/types.js';

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue(''),
      completeJSON: vi.fn().mockResolvedValue({}),
      getTotalTokens: vi.fn().mockReturnValue(0),
    } as unknown as PipelineDeps['llmClient'],
    soulText: {} as PipelineDeps['soulText'],
    narrativeRules: {} as PipelineDeps['narrativeRules'],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    text: '',
    prompt: 'test prompt',
    tokensUsed: 0,
    correctionAttempts: 0,
    synthesized: false,
    readerRetakeCount: 0,
    deps: makeDeps(),
    ...overrides,
  };
}

describe('createComplianceStage with chapterContext', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should use sync check when chapterContext is absent (backward compat)', async () => {
    const mockResult: ComplianceResult = {
      isCompliant: true,
      score: 1.0,
      violations: [],
    };

    vi.doMock('../../../src/compliance/checker.js', () => ({
      createCheckerFromSoulText: () => ({
        check: () => mockResult,
      }),
    }));

    const { createComplianceStage } = await import(
      '../../../src/pipeline/stages/compliance.js'
    );

    const stage = createComplianceStage();
    const ctx = makeContext({ text: 'compliant text' });
    const result = await stage(ctx);

    expect(result.complianceResult).toEqual(mockResult);
  });

  it('should use async checkWithContext when chapterContext is present', async () => {
    const mockResult: ComplianceResult = {
      isCompliant: true,
      score: 0.95,
      violations: [],
    };

    const checkWithContextMock = vi.fn().mockResolvedValue(mockResult);

    vi.doMock('../../../src/compliance/checker.js', () => ({
      createCheckerFromSoulText: () => ({
        checkWithContext: checkWithContextMock,
      }),
    }));

    const { createComplianceStage } = await import(
      '../../../src/pipeline/stages/compliance.js'
    );

    const chapterContext: ChapterContext = {
      previousChapterTexts: ['Chapter 1 text here'],
    };

    const stage = createComplianceStage();
    const ctx = makeContext({
      text: 'chapter 2 text',
      chapterContext,
    });
    const result = await stage(ctx);

    expect(result.complianceResult).toEqual(mockResult);
    expect(checkWithContextMock).toHaveBeenCalledWith('chapter 2 text', chapterContext);
  });

  it('should pass llmClient to createCheckerFromSoulText when chapterContext is present', async () => {
    const capturedArgs: unknown[] = [];
    const mockResult: ComplianceResult = {
      isCompliant: true,
      score: 1.0,
      violations: [],
    };

    vi.doMock('../../../src/compliance/checker.js', () => ({
      createCheckerFromSoulText: (...args: unknown[]) => {
        capturedArgs.push(...args);
        return {
          checkWithContext: vi.fn().mockResolvedValue(mockResult),
        };
      },
    }));

    const { createComplianceStage } = await import(
      '../../../src/pipeline/stages/compliance.js'
    );

    const deps = makeDeps();
    const chapterContext: ChapterContext = {
      previousChapterTexts: ['prev chapter'],
    };

    const stage = createComplianceStage();
    await stage(makeContext({ deps, chapterContext }));

    expect(capturedArgs[0]).toBe(deps.soulText);
    expect(capturedArgs[1]).toBe(deps.narrativeRules);
    expect(capturedArgs[2]).toBe(deps.llmClient);
  });

  it('should preserve chapterContext in output context', async () => {
    vi.doMock('../../../src/compliance/checker.js', () => ({
      createCheckerFromSoulText: () => ({
        checkWithContext: vi.fn().mockResolvedValue({
          isCompliant: true,
          score: 1.0,
          violations: [],
        }),
      }),
    }));

    const { createComplianceStage } = await import(
      '../../../src/pipeline/stages/compliance.js'
    );

    const chapterContext: ChapterContext = {
      previousChapterTexts: ['ch1'],
    };

    const stage = createComplianceStage();
    const ctx = makeContext({ text: 'text', chapterContext });
    const result = await stage(ctx);

    expect(result.chapterContext).toEqual(chapterContext);
  });
});
