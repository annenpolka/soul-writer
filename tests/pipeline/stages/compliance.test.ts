import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { ComplianceResult } from '../../../src/agents/types.js';

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

describe('createComplianceStage', () => {
  it('should run compliance check and set complianceResult on context', async () => {
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
    expect(result.text).toBe('compliant text');
  });

  it('should report violations when text is non-compliant', async () => {
    const mockResult: ComplianceResult = {
      isCompliant: false,
      score: 0.5,
      violations: [
        {
          type: 'forbidden_word',
          position: { start: 0, end: 3 },
          context: 'bad word',
          rule: 'no bad words',
          severity: 'error',
        },
      ],
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
    const ctx = makeContext({ text: 'non-compliant text' });
    const result = await stage(ctx);

    expect(result.complianceResult?.isCompliant).toBe(false);
    expect(result.complianceResult?.violations).toHaveLength(1);
  });

  it('should preserve other context fields', async () => {
    vi.doMock('../../../src/compliance/checker.js', () => ({
      createCheckerFromSoulText: () => ({
        check: () => ({ isCompliant: true, score: 1.0, violations: [] }),
      }),
    }));

    const { createComplianceStage } = await import(
      '../../../src/pipeline/stages/compliance.js'
    );

    const stage = createComplianceStage();
    const ctx = makeContext({
      text: 'text',
      champion: 'writer_1',
      tokensUsed: 300,
      correctionAttempts: 1,
    });
    const result = await stage(ctx);

    expect(result.champion).toBe('writer_1');
    expect(result.tokensUsed).toBe(300);
    expect(result.correctionAttempts).toBe(1);
  });

  it('should pass soulText and narrativeRules to checker factory', async () => {
    const capturedArgs: unknown[] = [];

    vi.doMock('../../../src/compliance/checker.js', () => ({
      createCheckerFromSoulText: (...args: unknown[]) => {
        capturedArgs.push(...args);
        return {
          check: () => ({ isCompliant: true, score: 1.0, violations: [] }),
        };
      },
    }));

    const { createComplianceStage } = await import(
      '../../../src/pipeline/stages/compliance.js'
    );

    const deps = makeDeps();
    const stage = createComplianceStage();
    await stage(makeContext({ deps }));

    expect(capturedArgs[0]).toBe(deps.soulText);
    expect(capturedArgs[1]).toBe(deps.narrativeRules);
  });
});
