import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCorrectionLoop } from '../../src/correction/loop.js';
import type { Corrector, Violation, ComplianceResult } from '../../src/agents/types.js';

interface Checker {
  check: (text: string) => ComplianceResult;
  checkWithContext: (text: string, ctx: { previousChapterTexts: string[] }) => Promise<ComplianceResult>;
}

function createMockCorrector(correctedText: string = 'corrected text'): Corrector {
  return {
    correct: vi.fn().mockResolvedValue({
      correctedText,
      tokensUsed: 50,
    }),
  };
}

function createMockChecker(overrides?: {
  initialCompliant?: boolean;
  subsequentCompliant?: boolean;
}): Checker {
  const { initialCompliant = false, subsequentCompliant = true } = overrides ?? {};
  let callCount = 0;
  const result = {
    check: vi.fn().mockImplementation((): ComplianceResult => {
      callCount++;
      const isCompliant = callCount === 1 ? initialCompliant : subsequentCompliant;
      return {
        isCompliant,
        score: isCompliant ? 1.0 : 0.5,
        violations: isCompliant ? [] : [{
          type: 'forbidden_word' as const,
          position: { start: 0, end: 3 },
          context: 'test violation',
          rule: 'test rule',
          severity: 'error' as const,
        }],
      };
    }),
    checkWithContext: vi.fn().mockImplementation(async (): Promise<ComplianceResult> => {
      callCount++;
      const isCompliant = callCount === 1 ? initialCompliant : subsequentCompliant;
      return {
        isCompliant,
        score: isCompliant ? 1.0 : 0.5,
        violations: isCompliant ? [] : [{
          type: 'forbidden_word' as const,
          position: { start: 0, end: 3 },
          context: 'test violation',
          rule: 'test rule',
          severity: 'error' as const,
        }],
      };
    }),
  };
  return result;
}

describe('createCorrectionLoop (FP)', () => {
  it('should return an object with run method', () => {
    const corrector = createMockCorrector();
    const checker = createMockChecker();

    const loop = createCorrectionLoop({ corrector, checker });

    expect(loop).toBeDefined();
    expect(typeof loop.run).toBe('function');
  });

  it('should return immediately if text is already compliant', async () => {
    const corrector = createMockCorrector();
    const checker = createMockChecker({ initialCompliant: true });

    const loop = createCorrectionLoop({ corrector, checker });
    const result = await loop.run('compliant text');

    expect(result.success).toBe(true);
    expect(result.finalText).toBe('compliant text');
    expect(result.attempts).toBe(0);
    expect(corrector.correct).not.toHaveBeenCalled();
  });

  it('should attempt correction for non-compliant text', async () => {
    const corrector = createMockCorrector('fixed text');
    const checker = createMockChecker({ initialCompliant: false, subsequentCompliant: true });

    const loop = createCorrectionLoop({ corrector, checker });
    const result = await loop.run('bad text');

    expect(result.success).toBe(true);
    expect(result.finalText).toBe('fixed text');
    expect(result.attempts).toBe(1);
    expect(corrector.correct).toHaveBeenCalledTimes(1);
  });

  it('should retry up to maxAttempts if corrections fail', async () => {
    const corrector = createMockCorrector('still bad');
    const checker = createMockChecker({ initialCompliant: false, subsequentCompliant: false });

    const loop = createCorrectionLoop({ corrector, checker, maxAttempts: 3 });
    const result = await loop.run('bad text');

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(corrector.correct).toHaveBeenCalledTimes(3);
  });

  it('should use default maxAttempts of 3', async () => {
    const corrector = createMockCorrector('still bad');
    const checker = createMockChecker({ initialCompliant: false, subsequentCompliant: false });

    const loop = createCorrectionLoop({ corrector, checker });
    const result = await loop.run('bad text');

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
  });

  it('should accumulate tokens used across attempts', async () => {
    const corrector = createMockCorrector('still bad');
    const checker = createMockChecker({ initialCompliant: false, subsequentCompliant: false });

    const loop = createCorrectionLoop({ corrector, checker, maxAttempts: 2 });
    const result = await loop.run('bad text');

    expect(result.totalTokensUsed).toBe(100); // 2 attempts x 50 tokens
  });

  it('should track originalViolations on failure', async () => {
    const corrector = createMockCorrector('still bad');
    const checker = createMockChecker({ initialCompliant: false, subsequentCompliant: false });

    const loop = createCorrectionLoop({ corrector, checker, maxAttempts: 1 });
    const result = await loop.run('bad text');

    expect(result.success).toBe(false);
    expect(result.originalViolations).toBeDefined();
    expect(result.originalViolations!.length).toBeGreaterThan(0);
  });

  it('should merge initialViolations with check violations', async () => {
    const corrector = createMockCorrector('fixed text');
    const checker = createMockChecker({ initialCompliant: false, subsequentCompliant: true });

    const selfRepViolation: Violation = {
      type: 'self_repetition',
      position: { start: 0, end: 10 },
      context: 'repeated phrase',
      rule: 'phrase: repeated',
      severity: 'error',
    };

    const loop = createCorrectionLoop({ corrector, checker });
    await loop.run('bad text', [selfRepViolation]);

    // Corrector should receive merged violations
    const callArgs = (corrector.correct as ReturnType<typeof vi.fn>).mock.calls[0];
    const violations = callArgs[1] as Violation[];
    expect(violations.some(v => v.type === 'self_repetition')).toBe(true);
    expect(violations.some(v => v.type === 'forbidden_word')).toBe(true);
  });

  it('should use checkWithContext when chapterContext is provided', async () => {
    const corrector = createMockCorrector('fixed text');
    const checker = createMockChecker({ initialCompliant: true });
    const chapterContext = { previousChapterTexts: ['prev chapter'] };

    const loop = createCorrectionLoop({ corrector, checker });
    await loop.run('text', undefined, chapterContext);

    expect(checker.checkWithContext).toHaveBeenCalledWith('text', chapterContext);
    expect(checker.check).not.toHaveBeenCalled();
  });
});
