import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { ComplianceResult, CorrectionResult } from '../../../src/agents/types.js';

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

describe('createCorrectionStage', () => {
  it('should skip correction when complianceResult is absent', async () => {
    const { createCorrectionStage } = await import(
      '../../../src/pipeline/stages/correction.js'
    );

    const stage = createCorrectionStage();
    const ctx = makeContext({ text: 'original text' });
    const result = await stage(ctx);

    expect(result.text).toBe('original text');
    expect(result.correctionAttempts).toBe(0);
  });

  it('should skip correction when text is already compliant', async () => {
    const { createCorrectionStage } = await import(
      '../../../src/pipeline/stages/correction.js'
    );

    const compliantResult: ComplianceResult = {
      isCompliant: true,
      score: 1.0,
      violations: [],
    };

    const stage = createCorrectionStage();
    const ctx = makeContext({
      text: 'compliant text',
      complianceResult: compliantResult,
    });
    const result = await stage(ctx);

    expect(result.text).toBe('compliant text');
    expect(result.correctionAttempts).toBe(0);
  });

  it('should run correction loop when non-compliant', async () => {
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

    vi.doMock('../../../src/correction/loop.js', () => ({
      createCorrectionLoop: () => ({
        run: async () => ({
          success: true,
          finalText: 'corrected text',
          attempts: 2,
          totalTokensUsed: 150,
        }),
      }),
    }));

    vi.doMock('../../../src/agents/corrector.js', () => ({
      createCorrector: () => ({
        correct: async () => ({ correctedText: 'corrected text', tokensUsed: 75 }),
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

    const stage = createCorrectionStage(3);
    const ctx = makeContext({
      text: 'non-compliant text',
      tokensUsed: 200,
      complianceResult: nonCompliantResult,
    });
    const result = await stage(ctx);

    expect(result.text).toBe('corrected text');
    expect(result.correctionAttempts).toBe(2);
    expect(result.tokensUsed).toBe(200 + 150);
  });

  it('should handle correction loop failure gracefully', async () => {
    const nonCompliantResult: ComplianceResult = {
      isCompliant: false,
      score: 0.3,
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

    vi.doMock('../../../src/correction/loop.js', () => ({
      createCorrectionLoop: () => ({
        run: async () => ({
          success: false,
          finalText: 'still bad text',
          attempts: 3,
          totalTokensUsed: 300,
          originalViolations: nonCompliantResult.violations,
        }),
      }),
    }));

    vi.doMock('../../../src/agents/corrector.js', () => ({
      createCorrector: () => ({
        correct: async () => ({ correctedText: 'still bad text', tokensUsed: 100 }),
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

    const stage = createCorrectionStage(3);
    const ctx = makeContext({
      text: 'bad text',
      tokensUsed: 100,
      complianceResult: nonCompliantResult,
    });
    const result = await stage(ctx);

    // Even on failure, text should be updated to the best attempt
    expect(result.text).toBe('still bad text');
    expect(result.correctionAttempts).toBe(3);
    expect(result.tokensUsed).toBe(100 + 300);
  });

  it('should preserve other context fields', async () => {
    const { createCorrectionStage } = await import(
      '../../../src/pipeline/stages/correction.js'
    );

    const stage = createCorrectionStage();
    const ctx = makeContext({
      text: 'text',
      champion: 'writer_1',
      synthesized: true,
      complianceResult: { isCompliant: true, score: 1.0, violations: [] },
    });
    const result = await stage(ctx);

    expect(result.champion).toBe('writer_1');
    expect(result.synthesized).toBe(true);
  });
});
