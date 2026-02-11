import { describe, it, expect, vi } from 'vitest';
import { createCheckerFromSoulText, createComplianceChecker } from '../../src/compliance/checker.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { ComplianceRule } from '../../src/compliance/rules/forbidden-words.js';

const mockSoulText = createMockSoulText({
  forbiddenWords: ['とても', '非常に'],
  forbiddenSimiles: ['天使のような', '悪魔のような'],
  deep: {
    constitution: {
      universal: {
        vocabulary: {
          special_marks: { mark: '×', usage: 'test', forms: ['×した', '×される'] },
        },
      },
    },
  } as never,
});

describe('createCheckerFromSoulText (FP)', () => {
  it('should return a ComplianceCheckerFn with check and checkWithContext', () => {
    const checker = createCheckerFromSoulText(mockSoulText);

    expect(checker.check).toBeInstanceOf(Function);
    expect(checker.checkWithContext).toBeInstanceOf(Function);
  });

  describe('check', () => {
    it('should return compliant result for clean text', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('透心は静かに窓の外を見つめていた。');

      expect(result.isCompliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should detect forbidden words', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('透心はとても美しかった。');

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('forbidden_word');
      expect(result.errorCount).toBe(1);
      expect(result.warningCount).toBe(0);
    });

    it('should detect forbidden similes', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('彼女は天使のような笑顔を見せた。');

      expect(result.isCompliant).toBe(false);
      const simileViolations = result.violations.filter(v => v.type === 'forbidden_simile');
      expect(simileViolations).toHaveLength(1);
      expect(result.errorCount).toBeGreaterThanOrEqual(1);
    });

    it('should detect special mark misuse', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('透心は×になってしまった。');

      expect(result.isCompliant).toBe(false);
      expect(result.violations[0].type).toBe('special_mark_misuse');
      expect(result.errorCount).toBeGreaterThanOrEqual(1);
    });

    it('should detect multiple violations', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('とても天使のような笑顔で、非常に美しかった。');

      expect(result.violations.length).toBeGreaterThanOrEqual(3);
      expect(result.isCompliant).toBe(false);
      expect(result.errorCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('checkWithContext', () => {
    it('should run both sync and async rules', async () => {
      const mockLLMClient = {
        complete: vi.fn(),
        completeWithTools: vi.fn(),
        getTotalTokens: vi.fn().mockReturnValue(0),
      };
      const checker = createCheckerFromSoulText(mockSoulText, undefined, mockLLMClient);

      // The checker should have async rules when llmClient is provided
      expect(checker.checkWithContext).toBeInstanceOf(Function);
    });

    it('should return compliant when no violations', async () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = await checker.checkWithContext('問題のないテキスト。');

      expect(result.isCompliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });
  });

  describe('with narrativeRules', () => {
    it('should accept narrativeRules parameter', () => {
      const narrativeRules = { isDefaultProtagonist: false, pov: 'third-person-limited' as const, pronoun: null, protagonistName: null, povDescription: '三人称' };
      const checker = createCheckerFromSoulText(mockSoulText, narrativeRules);

      expect(checker.check).toBeInstanceOf(Function);
    });
  });

  describe('with llmClient', () => {
    it('should accept llmClient and register async rules', () => {
      const mockLLMClient = {
        complete: vi.fn(),
        completeWithTools: vi.fn(),
        getTotalTokens: vi.fn().mockReturnValue(0),
      };
      const checker = createCheckerFromSoulText(mockSoulText, undefined, mockLLMClient);

      expect(checker.check).toBeInstanceOf(Function);
      expect(checker.checkWithContext).toBeInstanceOf(Function);
    });
  });
});

describe('Compliance 2-tier (error/warning)', () => {
  function makeRule(severity: 'error' | 'warning', type = 'test_rule'): ComplianceRule {
    return {
      name: `${severity}-rule`,
      check: () => [{
        type: type as never,
        position: { start: 0, end: 1 },
        context: 'test',
        rule: `${severity}-rule`,
        severity,
      }],
    };
  }

  it('error violation only: isCompliant=false, errorCount=1, warningCount=0', () => {
    const checker = createComplianceChecker([makeRule('error')]);
    const result = checker.check('test text');

    expect(result.isCompliant).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(0);
  });

  it('warning violation only: isCompliant=true, errorCount=0, warningCount=1', () => {
    const checker = createComplianceChecker([makeRule('warning')]);
    const result = checker.check('test text');

    expect(result.isCompliant).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(1);
  });

  it('error + warning: isCompliant=false, errorCount=1, warningCount=1', () => {
    const checker = createComplianceChecker([makeRule('error'), makeRule('warning')]);
    const result = checker.check('test text');

    expect(result.isCompliant).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(1);
  });

  it('no violations: isCompliant=true, errorCount=0, warningCount=0', () => {
    const noViolationRule: ComplianceRule = {
      name: 'no-violation-rule',
      check: () => [],
    };
    const checker = createComplianceChecker([noViolationRule]);
    const result = checker.check('test text');

    expect(result.isCompliant).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('checkWithContext: error violation only: isCompliant=false', async () => {
    const checker = createComplianceChecker([makeRule('error')]);
    const result = await checker.checkWithContext('test text');

    expect(result.isCompliant).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(0);
  });

  it('checkWithContext: warning only: isCompliant=true', async () => {
    const checker = createComplianceChecker([makeRule('warning')]);
    const result = await checker.checkWithContext('test text');

    expect(result.isCompliant).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(1);
  });
});
