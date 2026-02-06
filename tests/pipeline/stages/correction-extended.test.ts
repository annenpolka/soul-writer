import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { ComplianceResult } from '../../../src/agents/types.js';
import type { ChapterContext } from '../../../src/agents/types.js';

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue('corrected text'),
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

describe('createCorrectionStage with chapterContext', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should pass chapterContext to loop.run when present', async () => {
    const nonCompliantResult: ComplianceResult = {
      isCompliant: false,
      score: 0.5,
      violations: [
        {
          type: 'forbidden_word',
          position: { start: 0, end: 3 },
          context: 'bad',
          rule: 'forbidden',
          severity: 'error',
        },
      ],
    };

    const runMock = vi.fn().mockResolvedValue({
      success: true,
      finalText: 'corrected text',
      attempts: 1,
      totalTokensUsed: 100,
    });

    vi.doMock('../../../src/correction/loop.js', () => ({
      createCorrectionLoop: () => ({
        run: runMock,
      }),
    }));

    vi.doMock('../../../src/agents/corrector.js', () => ({
      createCorrector: () => ({
        correct: async () => ({ correctedText: 'corrected', tokensUsed: 50 }),
      }),
    }));

    vi.doMock('../../../src/compliance/checker.js', () => ({
      createCheckerFromSoulText: () => ({
        check: () => nonCompliantResult,
      }),
    }));

    const { createCorrectionStage } = await import(
      '../../../src/pipeline/stages/correction.js'
    );

    const chapterContext: ChapterContext = {
      previousChapterTexts: ['Chapter 1 text'],
    };

    const stage = createCorrectionStage();
    const ctx = makeContext({
      text: 'non-compliant text',
      tokensUsed: 200,
      complianceResult: nonCompliantResult,
      chapterContext,
    });
    const result = await stage(ctx);

    expect(runMock).toHaveBeenCalledWith(
      'non-compliant text',
      nonCompliantResult.violations,
      chapterContext,
    );
    expect(result.text).toBe('corrected text');
  });

  it('should pass undefined chapterContext to loop.run when absent', async () => {
    const nonCompliantResult: ComplianceResult = {
      isCompliant: false,
      score: 0.5,
      violations: [
        {
          type: 'forbidden_word',
          position: { start: 0, end: 3 },
          context: 'bad',
          rule: 'forbidden',
          severity: 'error',
        },
      ],
    };

    const runMock = vi.fn().mockResolvedValue({
      success: true,
      finalText: 'corrected text',
      attempts: 1,
      totalTokensUsed: 100,
    });

    vi.doMock('../../../src/correction/loop.js', () => ({
      createCorrectionLoop: () => ({
        run: runMock,
      }),
    }));

    vi.doMock('../../../src/agents/corrector.js', () => ({
      createCorrector: () => ({
        correct: async () => ({ correctedText: 'corrected', tokensUsed: 50 }),
      }),
    }));

    vi.doMock('../../../src/compliance/checker.js', () => ({
      createCheckerFromSoulText: () => ({
        check: () => nonCompliantResult,
      }),
    }));

    const { createCorrectionStage } = await import(
      '../../../src/pipeline/stages/correction.js'
    );

    const stage = createCorrectionStage();
    const ctx = makeContext({
      text: 'non-compliant text',
      tokensUsed: 200,
      complianceResult: nonCompliantResult,
    });
    await stage(ctx);

    expect(runMock).toHaveBeenCalledWith(
      'non-compliant text',
      nonCompliantResult.violations,
      undefined,
    );
  });

  it('should preserve chapterContext in output context', async () => {
    const { createCorrectionStage } = await import(
      '../../../src/pipeline/stages/correction.js'
    );

    const chapterContext: ChapterContext = {
      previousChapterTexts: ['ch1'],
    };

    const stage = createCorrectionStage();
    // compliant -> skip correction, but chapterContext should be preserved
    const ctx = makeContext({
      text: 'compliant text',
      complianceResult: { isCompliant: true, score: 1.0, violations: [] },
      chapterContext,
    });
    const result = await stage(ctx);

    expect(result.chapterContext).toEqual(chapterContext);
  });
});
