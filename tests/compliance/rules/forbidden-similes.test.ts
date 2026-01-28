import { describe, it, expect } from 'vitest';
import { ForbiddenSimilesRule } from '../../../src/compliance/rules/forbidden-similes.js';

describe('ForbiddenSimilesRule', () => {
  describe('interface', () => {
    it('should implement ComplianceRule interface', () => {
      const rule = new ForbiddenSimilesRule(['〜のような', '〜みたいな']);
      expect(rule.name).toBe('forbidden_similes');
      expect(typeof rule.check).toBe('function');
    });
  });

  describe('check', () => {
    it('should detect forbidden simile pattern', () => {
      const rule = new ForbiddenSimilesRule(['まるで花のように']);
      const text = 'まるで花のように美しかった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('forbidden_simile');
    });

    it('should detect partial match of forbidden simile', () => {
      const rule = new ForbiddenSimilesRule(['天使のような']);
      const text = 'その子は天使のような笑顔を見せた。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toContain('天使のような');
    });

    it('should detect multiple forbidden similes', () => {
      const rule = new ForbiddenSimilesRule(['天使のような', '悪魔のような']);
      const text =
        '天使のような笑顔と悪魔のような眼差しを持っていた。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(2);
    });

    it('should return empty array when no forbidden similes found', () => {
      const rule = new ForbiddenSimilesRule(['天使のような']);
      const text = '静かな朝だった。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(0);
    });

    it('should return correct positions', () => {
      const rule = new ForbiddenSimilesRule(['天使のような']);
      const text = 'その天使のような笑顔。';
      const violations = rule.check(text);

      expect(violations[0].position.start).toBe(2);
      expect(violations[0].position.end).toBe(8);
    });

    it('should include context around violation', () => {
      const rule = new ForbiddenSimilesRule(['天使のような']);
      const text =
        '長い文章の中でその天使のような笑顔を見せた少女がいた。';
      const violations = rule.check(text);

      expect(violations[0].context).toContain('天使のような');
    });

    it('should set severity to error', () => {
      const rule = new ForbiddenSimilesRule(['天使のような']);
      const text = '天使のような笑顔。';
      const violations = rule.check(text);

      expect(violations[0].severity).toBe('error');
    });

    it('should handle empty forbidden similes list', () => {
      const rule = new ForbiddenSimilesRule([]);
      const text = '天使のような笑顔。';
      const violations = rule.check(text);

      expect(violations).toHaveLength(0);
    });
  });
});
