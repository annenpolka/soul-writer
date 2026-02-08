import { describe, it, expect } from 'vitest';
import { createChineseContaminationRule } from '../../../src/compliance/rules/chinese-contamination.js';

describe('createChineseContaminationRule', () => {
  it('should return a ComplianceRule with name and check', () => {
    const rule = createChineseContaminationRule();
    expect(rule.name).toBe('chinese_contamination');
    expect(rule.check).toBeInstanceOf(Function);
  });

  it('should detect 并系 expressions', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('彼女は并发觉した。并且それは本当だった。');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].type).toBe('chinese_contamination');
    expect(violations[0].severity).toBe('error');
  });

  it('should detect Chinese conjunctions', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('因为天気がいいから、所以外に出た。');
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect Chinese demonstrative pronouns', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('这个世界は美しい。那个場所も。');
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect 们 pronoun patterns', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('他们は去った。我们も。');
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect Chinese prepositions', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('对于この問題、关于その件。');
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect Chinese temporal markers', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('已经終わっていた。正在進行中。');
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect simplified Chinese verbs', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('觉得それは正しい。认为間違いだ。');
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect secondary Chinese conjunctions', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('还是それでいい。而且もう一つ。');
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty for pure Japanese text', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('透心は静かに窓の外を見つめていた。つるぎが笑った。');
    expect(violations).toHaveLength(0);
  });

  it('should return empty for empty text', () => {
    const rule = createChineseContaminationRule();
    expect(rule.check('')).toHaveLength(0);
  });

  it('should not produce false positives for common Japanese kanji', () => {
    const rule = createChineseContaminationRule();
    // These use characters shared between Japanese and Chinese but in Japanese context
    const violations = rule.check('人々は大きな中庭に集まった。対話が始まった。');
    expect(violations).toHaveLength(0);
  });

  it('should include context around the match', () => {
    const rule = createChineseContaminationRule();
    const violations = rule.check('朝の光の中で并且それは始まった。');
    expect(violations).toHaveLength(1);
    expect(violations[0].context).toContain('并且');
  });

  it('should detect multiple violations in one text', () => {
    const rule = createChineseContaminationRule();
    const text = '因为雨が降ったので、他们は帰った。虽然遅かったが、还是間に合った。';
    const violations = rule.check(text);
    expect(violations.length).toBeGreaterThanOrEqual(4);
  });
});
