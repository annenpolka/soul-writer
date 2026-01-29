import { describe, it, expect } from 'vitest';
import { ComplianceChecker } from '../../src/compliance/checker.js';
import { ForbiddenWordsRule } from '../../src/compliance/rules/forbidden-words.js';
import type { SoulText } from '../../src/soul/manager.js';

const mockSoulText: SoulText = {
  constitution: {
    meta: { soul_id: 'test', soul_name: 'Test', version: '1.0', created_at: '', updated_at: '' },
    sentence_structure: {
      rhythm_pattern: 'test',
      taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
      typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
    },
    vocabulary: {
      bracket_notations: [],
      forbidden_words: ['とても', '非常に'],
      characteristic_expressions: [],
      special_marks: { mark: '×', usage: 'test', forms: ['×した', '×される'] },
    },
    rhetoric: {
      simile_base: 'test',
      metaphor_density: 'low',
      forbidden_similes: ['天使のような', '悪魔のような'],
      personification_allowed_for: [],
    },
    narrative: {
      default_pov: 'test',
      pov_by_character: {},
      default_tense: 'test',
      tense_shift_allowed: 'test',
      dialogue_ratio: 'test',
      dialogue_style_by_character: {},
    },
    thematic_constraints: {
      must_preserve: [],
      forbidden_resolutions: [],
    },
  },
  worldBible: {
    technology: {},
    society: {},
    characters: {},
    terminology: {},
    locations: {},
  },
  antiSoul: {
    categories: {
      theme_violation: [],
      mentor_tsurgi: [],
      lion_concretization: [],
      excessive_sentiment: [],
      explanatory_worldbuilding: [],
      character_normalization: [],
      cliche_simile: [],
    },
  },
  readerPersonas: { personas: [] },
  fragments: new Map(),
};

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
});
