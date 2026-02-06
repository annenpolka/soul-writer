import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAntiSoulCollector,
  type AntiSoulCollectorFn,
} from '../../src/learning/anti-soul-collector.js';
import type { CorrectionLoopResult } from '../../src/agents/types.js';
import type { AntiSoul } from '../../src/schemas/anti-soul.js';

const testAntiSoul: AntiSoul = {
  categories: {},
  violation_mapping: {
    theme_violation: 'theme_violation',
    forbidden_word: 'cliche_simile',
    forbidden_simile: 'cliche_simile',
    sentence_too_long: 'excessive_sentiment',
  },
  default_category: 'cliche_simile',
};

describe('createAntiSoulCollector (FP)', () => {
  let collector: AntiSoulCollectorFn;

  beforeEach(() => {
    collector = createAntiSoulCollector(testAntiSoul);
  });

  describe('collectFromFailedCorrection', () => {
    it('should collect anti-patterns from failed correction', () => {
      const result: CorrectionLoopResult = {
        success: false,
        finalText: 'Text that failed correction',
        attempts: 3,
        totalTokensUsed: 500,
        originalViolations: [
          {
            type: 'forbidden_word',
            position: { start: 0, end: 5 },
            context: 'bad text',
            rule: 'Forbidden word',
            severity: 'error',
          },
        ],
      };

      const patterns = collector.collectFromFailedCorrection(result);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].text).toBe('bad text');
      expect(patterns[0].category).toBe('cliche_simile');
      expect(patterns[0].source).toBe('auto');
    });

    it('should return empty array for successful correction', () => {
      const result: CorrectionLoopResult = {
        success: true,
        finalText: 'Corrected text',
        attempts: 1,
        totalTokensUsed: 100,
      };

      const patterns = collector.collectFromFailedCorrection(result);
      expect(patterns).toHaveLength(0);
    });

    it('should return empty array when no original violations', () => {
      const result: CorrectionLoopResult = {
        success: false,
        finalText: 'Failed text',
        attempts: 3,
        totalTokensUsed: 300,
      };

      const patterns = collector.collectFromFailedCorrection(result);
      expect(patterns).toHaveLength(0);
    });
  });

  describe('mapViolationToCategory', () => {
    it('should map known violation types', () => {
      const category = collector.mapViolationToCategory({
        type: 'theme_violation',
        position: { start: 0, end: 5 },
        context: 'test',
        rule: 'test',
        severity: 'error',
      });
      expect(category).toBe('theme_violation');
    });

    it('should use default category for unknown types', () => {
      const category = collector.mapViolationToCategory({
        type: 'unknown_type',
        position: { start: 0, end: 5 },
        context: 'test',
        rule: 'test',
        severity: 'error',
      });
      expect(category).toBe('cliche_simile');
    });
  });

  describe('with no antiSoul config', () => {
    it('should use defaults when no antiSoul provided', () => {
      const defaultCollector = createAntiSoulCollector();
      const category = defaultCollector.mapViolationToCategory({
        type: 'anything',
        position: { start: 0, end: 5 },
        context: 'test',
        rule: 'test',
        severity: 'error',
      });
      expect(category).toBe('cliche_simile');
    });
  });
});
