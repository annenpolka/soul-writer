import { describe, it, expect } from 'vitest';
import { ForbiddenWordsRule } from '../../../src/compliance/rules/forbidden-words.js';

describe('ForbiddenWordsRule', () => {
  describe('interface', () => {
    it('should implement ComplianceRule interface', () => {
      const rule = new ForbiddenWordsRule(['とても']);
      expect(rule.name).toBe('forbidden_words');
      expect(typeof rule.check).toBe('function');
    });
  });

  describe('check', () => {
    it('should detect forbidden word in text', () => {
      const rule = new ForbiddenWordsRule(['とても']);
      const text = 'それはとても美しい景色だった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('forbidden_word');
      expect(violations[0].rule).toContain('とても');
    });

    it('should detect multiple forbidden words', () => {
      const rule = new ForbiddenWordsRule(['とても', '非常に']);
      const text = 'それはとても美しく、非常に印象的だった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(2);
    });

    it('should detect multiple occurrences of same forbidden word', () => {
      const rule = new ForbiddenWordsRule(['とても']);
      const text = 'とても美しく、とても静かな場所だった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(2);
    });

    it('should return correct positions', () => {
      const rule = new ForbiddenWordsRule(['とても']);
      const text = 'それはとても美しい。';
      const violations = rule.check(text);

      expect(violations[0].position.start).toBe(3);
      expect(violations[0].position.end).toBe(6);
    });

    it('should include context around violation', () => {
      const rule = new ForbiddenWordsRule(['とても']);
      const text =
        '長い文章の中でそれはとても美しい景色だったと思う。';
      const violations = rule.check(text);

      expect(violations[0].context).toContain('とても');
      expect(violations[0].context.length).toBeLessThanOrEqual(50);
    });

    it('should return empty array when no forbidden words found', () => {
      const rule = new ForbiddenWordsRule(['とても']);
      const text = '静かな朝だった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(0);
    });

    it('should set severity to error', () => {
      const rule = new ForbiddenWordsRule(['とても']);
      const text = 'とても静かだった。';
      const violations = rule.check(text);

      expect(violations[0].severity).toBe('error');
    });

    it('should handle empty forbidden words list', () => {
      const rule = new ForbiddenWordsRule([]);
      const text = 'とても美しい景色だった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(0);
    });

    it('should handle empty text', () => {
      const rule = new ForbiddenWordsRule(['とても']);
      const violations = rule.check('');

      expect(violations).toHaveLength(0);
    });
  });
});
