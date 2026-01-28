import { describe, it, expect, beforeEach } from 'vitest';
import { AntiSoulCollector } from '../../src/learning/anti-soul-collector.js';
import type { CorrectionLoopResult, Violation } from '../../src/agents/types.js';

describe('AntiSoulCollector', () => {
  let collector: AntiSoulCollector;

  beforeEach(() => {
    collector = new AntiSoulCollector();
  });

  describe('constructor', () => {
    it('should create a collector', () => {
      expect(collector).toBeInstanceOf(AntiSoulCollector);
    });
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
            context: 'とても美しい',
            rule: 'Forbidden word',
            severity: 'error',
          },
          {
            type: 'forbidden_simile',
            position: { start: 10, end: 20 },
            context: '天使のような',
            rule: 'Forbidden simile',
            severity: 'error',
          },
        ],
      };

      const antiPatterns = collector.collectFromFailedCorrection(result);

      expect(antiPatterns).toHaveLength(2);
      expect(antiPatterns[0].text).toBe('とても美しい');
      expect(antiPatterns[1].text).toBe('天使のような');
    });

    it('should categorize anti-patterns correctly', () => {
      const result: CorrectionLoopResult = {
        success: false,
        finalText: 'Failed text',
        attempts: 3,
        totalTokensUsed: 300,
        originalViolations: [
          {
            type: 'theme_violation',
            position: { start: 0, end: 10 },
            context: 'Theme problem',
            rule: 'Theme rule',
            severity: 'error',
          },
        ],
      };

      const antiPatterns = collector.collectFromFailedCorrection(result);

      expect(antiPatterns[0].category).toBe('theme_violation');
    });

    it('should return empty array for successful correction', () => {
      const result: CorrectionLoopResult = {
        success: true,
        finalText: 'Corrected text',
        attempts: 1,
        totalTokensUsed: 100,
      };

      const antiPatterns = collector.collectFromFailedCorrection(result);

      expect(antiPatterns).toHaveLength(0);
    });

    it('should return empty array when no original violations', () => {
      const result: CorrectionLoopResult = {
        success: false,
        finalText: 'Failed text',
        attempts: 3,
        totalTokensUsed: 300,
      };

      const antiPatterns = collector.collectFromFailedCorrection(result);

      expect(antiPatterns).toHaveLength(0);
    });
  });

  describe('mapViolationToCategory', () => {
    it('should map forbidden_word to cliche_simile category', () => {
      const violation: Violation = {
        type: 'forbidden_word',
        position: { start: 0, end: 5 },
        context: 'test',
        rule: 'test',
        severity: 'error',
      };

      const category = collector.mapViolationToCategory(violation);
      expect(category).toBe('cliche_simile');
    });

    it('should map forbidden_simile to cliche_simile category', () => {
      const violation: Violation = {
        type: 'forbidden_simile',
        position: { start: 0, end: 5 },
        context: 'test',
        rule: 'test',
        severity: 'error',
      };

      const category = collector.mapViolationToCategory(violation);
      expect(category).toBe('cliche_simile');
    });

    it('should map theme_violation correctly', () => {
      const violation: Violation = {
        type: 'theme_violation',
        position: { start: 0, end: 5 },
        context: 'test',
        rule: 'test',
        severity: 'error',
      };

      const category = collector.mapViolationToCategory(violation);
      expect(category).toBe('theme_violation');
    });
  });
});
