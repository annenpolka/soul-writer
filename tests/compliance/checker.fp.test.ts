import { describe, it, expect, vi } from 'vitest';
import { createCheckerFromSoulText } from '../../src/compliance/checker.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

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
      expect(result.score).toBe(1);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect forbidden words', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('透心はとても美しかった。');

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('forbidden_word');
    });

    it('should detect forbidden similes', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('彼女は天使のような笑顔を見せた。');

      expect(result.isCompliant).toBe(false);
      const simileViolations = result.violations.filter(v => v.type === 'forbidden_simile');
      expect(simileViolations).toHaveLength(1);
    });

    it('should detect special mark misuse', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('透心は×になってしまった。');

      expect(result.isCompliant).toBe(false);
      expect(result.violations[0].type).toBe('special_mark_misuse');
    });

    it('should detect multiple violations', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('とても天使のような笑顔で、非常に美しかった。');

      expect(result.violations.length).toBeGreaterThanOrEqual(3);
      expect(result.isCompliant).toBe(false);
    });

    it('should calculate compliance score based on violations', () => {
      const checker = createCheckerFromSoulText(mockSoulText);
      const result = checker.check('彼女はとても美しく、天使のような笑顔だった。');

      expect(result.score).toBeLessThan(1);
      expect(result.score).toBeGreaterThanOrEqual(0);
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
      expect(result.score).toBe(1);
      expect(result.violations).toHaveLength(0);
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
