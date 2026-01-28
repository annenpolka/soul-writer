import { describe, it, expect } from 'vitest';
import { SpecialMarksRule } from '../../../src/compliance/rules/special-marks.js';

describe('SpecialMarksRule', () => {
  describe('interface', () => {
    it('should implement ComplianceRule interface', () => {
      const rule = new SpecialMarksRule('×', ['×した', '×してしまった']);
      expect(rule.name).toBe('special_marks');
      expect(typeof rule.check).toBe('function');
    });
  });

  describe('check', () => {
    it('should pass when special mark is used correctly', () => {
      const rule = new SpecialMarksRule('×', ['×した', '×される']);
      const text = '彼女は×した。その行為は×される運命だった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(0);
    });

    it('should detect incorrect usage of special mark', () => {
      const rule = new SpecialMarksRule('×', ['×した', '×される']);
      const text = '彼女は×。何かが×になった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(2);
      expect(violations[0].type).toBe('special_mark_misuse');
    });

    it('should detect mark used outside allowed forms', () => {
      const rule = new SpecialMarksRule('×', ['×した']);
      const text = '彼女は×した。彼は×しない。';
      const violations = rule.check(text);

      // '×した' is allowed, '×しない' is not
      expect(violations).toHaveLength(1);
      expect(violations[0].context).toContain('×しない');
    });

    it('should return correct positions', () => {
      const rule = new SpecialMarksRule('×', ['×した']);
      const text = 'あいう×えお';
      const violations = rule.check(text);

      expect(violations).toHaveLength(1);
      expect(violations[0].position.start).toBe(3);
      expect(violations[0].position.end).toBe(4);
    });

    it('should include context around violation', () => {
      const rule = new SpecialMarksRule('×', ['×した']);
      const text = '長い文章の中で彼女は×になってしまった。';
      const violations = rule.check(text);

      expect(violations[0].context).toContain('×');
    });

    it('should set severity to error for misuse', () => {
      const rule = new SpecialMarksRule('×', ['×した']);
      const text = '×になった';
      const violations = rule.check(text);

      expect(violations[0].severity).toBe('error');
    });

    it('should handle multiple marks in text', () => {
      const rule = new SpecialMarksRule('×', ['×した']);
      const text = '×した後に×された。さらに×もした。';
      const violations = rule.check(text);

      // '×した' is allowed, '×された' and '×も' are not
      expect(violations).toHaveLength(2);
    });

    it('should handle empty allowed forms list', () => {
      const rule = new SpecialMarksRule('×', []);
      const text = '×した';
      const violations = rule.check(text);

      // If no forms allowed, any usage is violation
      expect(violations).toHaveLength(1);
    });

    it('should handle text without special marks', () => {
      const rule = new SpecialMarksRule('×', ['×した']);
      const text = '普通の文章です。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(0);
    });

    it('should handle different special marks', () => {
      const rule = new SpecialMarksRule('◯', ['◯した']);
      const text = '彼女は◯した。そして◯になった。';
      const violations = rule.check(text);

      // '◯した' allowed, '◯に' not allowed
      expect(violations).toHaveLength(1);
    });
  });
});
