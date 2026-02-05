import { describe, it, expect, vi } from 'vitest';
import { ComplianceChecker } from '../../src/compliance/checker.js';
import { ForbiddenWordsRule } from '../../src/compliance/rules/forbidden-words.js';
import type { AsyncComplianceRule } from '../../src/compliance/rules/async-rule.js';
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

describe('ComplianceChecker', () => {
  describe('constructor', () => {
    it('should create a checker with rules from soul text', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      expect(checker).toBeInstanceOf(ComplianceChecker);
    });

    it('should create a checker with custom rules', () => {
      const rules = [new ForbiddenWordsRule(['テスト'])];
      const checker = new ComplianceChecker(rules);
      expect(checker).toBeInstanceOf(ComplianceChecker);
    });
  });

  describe('check', () => {
    it('should return compliant result for clean text', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const result = checker.check('透心は静かに窓の外を見つめていた。');

      expect(result.isCompliant).toBe(true);
      expect(result.score).toBe(1);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect forbidden words', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const result = checker.check('透心はとても美しかった。');

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('forbidden_word');
    });

    it('should detect forbidden similes', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const result = checker.check('彼女は天使のような笑顔を見せた。');

      expect(result.isCompliant).toBe(false);
      const simileViolations = result.violations.filter(v => v.type === 'forbidden_simile');
      expect(simileViolations).toHaveLength(1);
    });

    it('should detect special mark misuse', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const result = checker.check('透心は×になってしまった。');

      expect(result.isCompliant).toBe(false);
      expect(result.violations[0].type).toBe('special_mark_misuse');
    });

    it('should allow correct special mark usage', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const result = checker.check('透心は×した。');

      // Should not have special mark violations
      const markViolations = result.violations.filter((v) => v.type === 'special_mark_misuse');
      expect(markViolations).toHaveLength(0);
    });

    it('should detect multiple violations', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const result = checker.check('とても天使のような笑顔で、非常に美しかった。');

      expect(result.violations.length).toBeGreaterThanOrEqual(3);
      expect(result.isCompliant).toBe(false);
    });

    it('should calculate compliance score based on violations', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const text = '彼女はとても美しく、天使のような笑顔だった。';
      const result = checker.check(text);

      expect(result.score).toBeLessThan(1);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should mark as compliant when score >= 0.75', () => {
      const rules = [new ForbiddenWordsRule(['とても'])];
      const checker = new ComplianceChecker(rules);

      // Long text with only one violation should still be compliant
      const longText = '透心は静かに窓を見つめていた。'.repeat(20) + 'とても美しかった。';
      const result = checker.check(longText);

      // Score depends on text length vs violations
      if (result.score >= 0.75) {
        expect(result.isCompliant).toBe(true);
      } else {
        expect(result.isCompliant).toBe(false);
      }
    });
  });

  describe('getRules', () => {
    it('should return all registered rules', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const rules = checker.getRules();

      expect(rules.length).toBeGreaterThanOrEqual(2);
      expect(rules.some((r) => r.name === 'forbidden_words')).toBe(true);
      expect(rules.some((r) => r.name === 'forbidden_similes')).toBe(true);
    });
  });

  describe('checkWithContext', () => {
    it('should run both sync and async rules', async () => {
      const mockAsyncRule: AsyncComplianceRule = {
        name: 'test_async',
        check: vi.fn().mockResolvedValue([
          {
            type: 'self_repetition',
            position: { start: 0, end: 5 },
            context: 'test context',
            rule: 'test rule',
            severity: 'warning',
          },
        ]),
      };

      const syncRules = [new ForbiddenWordsRule(['とても'])];
      const checker = new ComplianceChecker(syncRules, [mockAsyncRule]);

      const result = await checker.checkWithContext('とても美しかった。');

      // Should have both sync (forbidden_word) and async (self_repetition) violations
      expect(result.violations.some(v => v.type === 'forbidden_word')).toBe(true);
      expect(result.violations.some(v => v.type === 'self_repetition')).toBe(true);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
    });

    it('should pass chapter context to async rules', async () => {
      const mockAsyncRule: AsyncComplianceRule = {
        name: 'test_async',
        check: vi.fn().mockResolvedValue([]),
      };

      const checker = new ComplianceChecker([], [mockAsyncRule]);
      const chapterContext = { previousChapterTexts: ['前章のテキスト。'] };

      await checker.checkWithContext('現在のテキスト。', chapterContext);

      expect(mockAsyncRule.check).toHaveBeenCalledWith('現在のテキスト。', chapterContext);
    });

    it('should return compliant when no violations from either sync or async', async () => {
      const mockAsyncRule: AsyncComplianceRule = {
        name: 'test_async',
        check: vi.fn().mockResolvedValue([]),
      };

      const checker = new ComplianceChecker([], [mockAsyncRule]);
      const result = await checker.checkWithContext('問題のないテキスト。');

      expect(result.isCompliant).toBe(true);
      expect(result.score).toBe(1);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('getAsyncRules', () => {
    it('should return async rules when provided', () => {
      const mockAsyncRule: AsyncComplianceRule = {
        name: 'test_async',
        check: vi.fn(),
      };
      const checker = new ComplianceChecker([], [mockAsyncRule]);
      expect(checker.getAsyncRules()).toHaveLength(1);
      expect(checker.getAsyncRules()[0].name).toBe('test_async');
    });

    it('should return empty array when no async rules', () => {
      const checker = new ComplianceChecker([]);
      expect(checker.getAsyncRules()).toHaveLength(0);
    });
  });

  describe('fromSoulText with llmClient', () => {
    it('should register SelfRepetitionRule when llmClient is provided', () => {
      const mockLLMClient = {
        complete: vi.fn(),
        completeWithTools: vi.fn(),
        getTotalTokens: vi.fn().mockReturnValue(0),
      };
      const checker = ComplianceChecker.fromSoulText(mockSoulText, undefined, mockLLMClient);
      expect(checker.getAsyncRules()).toHaveLength(1);
      expect(checker.getAsyncRules()[0].name).toBe('self_repetition');
    });

    it('should not register async rules when llmClient is not provided', () => {
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      expect(checker.getAsyncRules()).toHaveLength(0);
    });
  });
});
