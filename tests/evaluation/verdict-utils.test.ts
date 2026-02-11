import { describe, it, expect } from 'vitest';
import { isVerdictPassing, verdictToString, compareVerdicts, buildRetakeFeedback } from '../../src/evaluation/verdict-utils.js';
import type { VerdictLevel, Defect, TextWeakness } from '../../src/agents/types.js';

describe('isVerdictPassing', () => {
  it('should return true for publishable', () => {
    expect(isVerdictPassing('publishable')).toBe(true);
  });

  it('should return true for exceptional', () => {
    expect(isVerdictPassing('exceptional')).toBe(true);
  });

  it('should return false for acceptable', () => {
    expect(isVerdictPassing('acceptable')).toBe(false);
  });

  it('should return false for needs_work', () => {
    expect(isVerdictPassing('needs_work')).toBe(false);
  });

  it('should return false for unacceptable', () => {
    expect(isVerdictPassing('unacceptable')).toBe(false);
  });
});

describe('verdictToString', () => {
  it.each([
    ['exceptional', '出版水準超'],
    ['publishable', '出版可能'],
    ['acceptable', '構造的に機能'],
    ['needs_work', '要改善'],
    ['unacceptable', '根本的問題'],
  ] as [VerdictLevel, string][])('should return "%s" for %s', (level, expected) => {
    expect(verdictToString(level)).toBe(expected);
  });
});

describe('compareVerdicts', () => {
  it('should return negative when a < b', () => {
    expect(compareVerdicts('needs_work', 'publishable')).toBeLessThan(0);
  });

  it('should return positive when a > b', () => {
    expect(compareVerdicts('exceptional', 'acceptable')).toBeGreaterThan(0);
  });

  it('should return 0 when a === b', () => {
    expect(compareVerdicts('publishable', 'publishable')).toBe(0);
  });

  it('should correctly order all levels', () => {
    expect(compareVerdicts('unacceptable', 'needs_work')).toBeLessThan(0);
    expect(compareVerdicts('needs_work', 'acceptable')).toBeLessThan(0);
    expect(compareVerdicts('acceptable', 'publishable')).toBeLessThan(0);
    expect(compareVerdicts('publishable', 'exceptional')).toBeLessThan(0);
  });
});

describe('buildRetakeFeedback', () => {
  it('should include verdict level label and value', () => {
    const result = buildRetakeFeedback([], [], 'needs_work');
    expect(result).toContain('品質判定: 要改善 (needs_work)');
  });

  it('should include judge weaknesses when provided', () => {
    const weaknesses: TextWeakness[] = [
      { category: 'pacing', severity: 'major', description: 'テンポが遅い', suggestedFix: 'シーンを削減' },
    ];
    const result = buildRetakeFeedback([], weaknesses, 'needs_work');
    expect(result).toContain('Judge分析からの弱点');
    expect(result).toContain('[major/pacing] テンポが遅い');
    expect(result).toContain('修正案: シーンを削減');
  });

  it('should include defects when provided', () => {
    const defects: Defect[] = [
      { severity: 'critical', category: 'plot_contradiction', description: 'プロット矛盾', suggestedFix: '因果関係を修正' },
    ];
    const result = buildRetakeFeedback(defects, [], 'unacceptable');
    expect(result).toContain('検出された欠陥');
    expect(result).toContain('[critical/plot_contradiction] プロット矛盾');
    expect(result).toContain('修正案: 因果関係を修正');
  });

  it('should include both judge weaknesses and defects', () => {
    const weaknesses: TextWeakness[] = [
      { category: 'voice', severity: 'minor', description: '声の一貫性', suggestedFix: '統一する' },
    ];
    const defects: Defect[] = [
      { severity: 'major', category: 'pacing_issue', description: 'ペーシング問題' },
    ];
    const result = buildRetakeFeedback(defects, weaknesses, 'acceptable');
    expect(result).toContain('Judge分析からの弱点');
    expect(result).toContain('検出された欠陥');
  });

  it('should handle empty inputs gracefully', () => {
    const result = buildRetakeFeedback([], [], 'publishable');
    expect(result).toContain('品質判定: 出版可能 (publishable)');
    expect(result).not.toContain('Judge分析');
    expect(result).not.toContain('検出された欠陥');
  });
});
