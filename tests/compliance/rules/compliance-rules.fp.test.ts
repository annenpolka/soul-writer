import { describe, it, expect } from 'vitest';
import { createForbiddenWordsRule } from '../../../src/compliance/rules/forbidden-words.js';
import { createForbiddenSimilesRule } from '../../../src/compliance/rules/forbidden-similes.js';
import { createSpecialMarksRule } from '../../../src/compliance/rules/special-marks.js';
import { createPovConsistencyRule } from '../../../src/compliance/rules/pov-consistency.js';
import { createRhythmCheckRule } from '../../../src/compliance/rules/rhythm-check.js';
import { createMarkdownContaminationRule } from '../../../src/compliance/rules/markdown-contamination.js';
import { createQuoteOriginalityRule } from '../../../src/compliance/rules/quote-originality.js';
import type { Fragment } from '../../../src/schemas/fragments.js';

describe('createForbiddenWordsRule (FP)', () => {
  it('should return a ComplianceRule with name and check', () => {
    const rule = createForbiddenWordsRule(['とても']);
    expect(rule.name).toBe('forbidden_words');
    expect(rule.check).toBeInstanceOf(Function);
  });

  it('should detect forbidden words', () => {
    const rule = createForbiddenWordsRule(['とても', '非常に']);
    const violations = rule.check('とても美しい非常に素敵な文章。');
    expect(violations).toHaveLength(2);
    expect(violations[0].type).toBe('forbidden_word');
    expect(violations[1].type).toBe('forbidden_word');
  });

  it('should return empty for clean text', () => {
    const rule = createForbiddenWordsRule(['とても']);
    expect(rule.check('美しい文章。')).toHaveLength(0);
  });

  it('should return empty for empty forbidden list', () => {
    const rule = createForbiddenWordsRule([]);
    expect(rule.check('とても美しい。')).toHaveLength(0);
  });
});

describe('createForbiddenSimilesRule (FP)', () => {
  it('should return a ComplianceRule with name and check', () => {
    const rule = createForbiddenSimilesRule(['天使のような']);
    expect(rule.name).toBe('forbidden_similes');
    expect(rule.check).toBeInstanceOf(Function);
  });

  it('should detect forbidden similes', () => {
    const rule = createForbiddenSimilesRule(['天使のような', '悪魔のような']);
    const violations = rule.check('天使のような笑顔で悪魔のような行為。');
    expect(violations).toHaveLength(2);
    expect(violations[0].type).toBe('forbidden_simile');
  });

  it('should return empty for clean text', () => {
    const rule = createForbiddenSimilesRule(['天使のような']);
    expect(rule.check('美しい笑顔。')).toHaveLength(0);
  });
});

describe('createSpecialMarksRule (FP)', () => {
  it('should return a ComplianceRule with name and check', () => {
    const rule = createSpecialMarksRule('×', ['×した', '×される']);
    expect(rule.name).toBe('special_marks');
    expect(rule.check).toBeInstanceOf(Function);
  });

  it('should detect misuse of special marks', () => {
    const rule = createSpecialMarksRule('×', ['×した', '×される']);
    const violations = rule.check('透心は×になってしまった。');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].type).toBe('special_mark_misuse');
  });

  it('should allow correct forms', () => {
    const rule = createSpecialMarksRule('×', ['×した', '×される']);
    const violations = rule.check('透心は×した。');
    const markViolations = violations.filter(v => v.type === 'special_mark_misuse');
    expect(markViolations).toHaveLength(0);
  });
});

describe('createPovConsistencyRule (FP)', () => {
  it('should return a ComplianceRule with name and check', () => {
    const rule = createPovConsistencyRule();
    expect(rule.name).toBe('pov_consistency');
    expect(rule.check).toBeInstanceOf(Function);
  });

  it('should detect wrong pronoun in narration', () => {
    const rule = createPovConsistencyRule();
    const violations = rule.check('私は窓の外を見つめていた。');
    expect(violations.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip checks for non-default narrative', () => {
    const rule = createPovConsistencyRule({ pov: 'third-person', isDefaultProtagonist: false });
    const violations = rule.check('私は窓の外を見つめていた。');
    expect(violations).toHaveLength(0);
  });

  it('should not flag compound words with 私', () => {
    const rule = createPovConsistencyRule();
    const violations = rule.check('私立高校に通っていた。');
    expect(violations).toHaveLength(0);
  });
});

describe('createRhythmCheckRule (FP)', () => {
  it('should return a ComplianceRule with name and check', () => {
    const rule = createRhythmCheckRule();
    expect(rule.name).toBe('rhythm_check');
    expect(rule.check).toBeInstanceOf(Function);
  });

  it('should detect sentences exceeding max length', () => {
    const longSentence = 'あ'.repeat(110) + '。';
    const rule = createRhythmCheckRule(100);
    const violations = rule.check(longSentence);
    expect(violations.some(v => v.type === 'sentence_too_long')).toBe(true);
  });

  it('should accept short sentences', () => {
    const rule = createRhythmCheckRule(100);
    const violations = rule.check('短い文。');
    expect(violations).toHaveLength(0);
  });

  it('should accept custom maxSentenceLength', () => {
    const rule = createRhythmCheckRule(50);
    const text = 'あ'.repeat(55) + '。';
    const violations = rule.check(text);
    expect(violations.some(v => v.type === 'sentence_too_long')).toBe(true);
  });
});

describe('createMarkdownContaminationRule (FP)', () => {
  it('should return a ComplianceRule with name and check', () => {
    const rule = createMarkdownContaminationRule();
    expect(rule.name).toBe('markdown_contamination');
    expect(rule.check).toBeInstanceOf(Function);
  });

  it('should detect bold markdown', () => {
    const rule = createMarkdownContaminationRule();
    const violations = rule.check('これは**太字**です。');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].type).toBe('markdown_contamination');
  });

  it('should detect heading markdown', () => {
    const rule = createMarkdownContaminationRule();
    const violations = rule.check('# 見出し\nテキスト。');
    expect(violations.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for clean prose', () => {
    const rule = createMarkdownContaminationRule();
    expect(rule.check('透心は静かに窓の外を見つめていた。')).toHaveLength(0);
  });
});

describe('createQuoteOriginalityRule (FP)', () => {
  const fragments: Map<string, Fragment[]> = new Map([
    ['dialogue', [
      { text: '「おまえは正解だ」とつるぎが言った。', quality_markers: ['dialogue'], context: 'test' },
    ]],
  ]);

  it('should return a ComplianceRule with name and check', () => {
    const rule = createQuoteOriginalityRule(fragments);
    expect(rule.name).toBe('quote_originality');
    expect(rule.check).toBeInstanceOf(Function);
  });

  it('should detect direct quotes from fragments', () => {
    const rule = createQuoteOriginalityRule(fragments);
    const violations = rule.check('おまえは正解だ');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].type).toBe('quote_direct_copy');
  });

  it('should return empty for original text', () => {
    const rule = createQuoteOriginalityRule(fragments);
    expect(rule.check('全くオリジナルな文章。')).toHaveLength(0);
  });

  it('should return empty for empty fragments', () => {
    const rule = createQuoteOriginalityRule(new Map());
    expect(rule.check('おまえは正解だ')).toHaveLength(0);
  });
});
