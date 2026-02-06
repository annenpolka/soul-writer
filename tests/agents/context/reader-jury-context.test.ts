import { describe, it, expect } from 'vitest';
import type { PersonaEvaluation } from '../../../src/agents/types.js';
import { calculateAggregatedScore, generateSummary } from '../../../src/agents/context/reader-jury-context.js';

function makeEvaluation(overrides: Partial<PersonaEvaluation> & { personaName: string; weightedScore: number }): PersonaEvaluation {
  return {
    personaId: 'test',
    personaName: overrides.personaName,
    categoryScores: { style: 0.5, plot: 0.5, character: 0.5, worldbuilding: 0.5, readability: 0.5 },
    weightedScore: overrides.weightedScore,
    feedback: {
      strengths: overrides.feedback?.strengths ?? '良い点',
      weaknesses: overrides.feedback?.weaknesses ?? '課題',
      suggestion: overrides.feedback?.suggestion ?? '提案',
    },
    ...overrides,
  };
}

describe('calculateAggregatedScore', () => {
  it('should return 0 for empty evaluations', () => {
    expect(calculateAggregatedScore([])).toBe(0);
  });

  it('should calculate mean of weighted scores', () => {
    const evaluations = [
      makeEvaluation({ personaName: 'A', weightedScore: 0.8 }),
      makeEvaluation({ personaName: 'B', weightedScore: 0.6 }),
    ];
    expect(calculateAggregatedScore(evaluations)).toBeCloseTo(0.7, 3);
  });

  it('should handle single evaluation', () => {
    const evaluations = [
      makeEvaluation({ personaName: 'A', weightedScore: 0.9 }),
    ];
    expect(calculateAggregatedScore(evaluations)).toBeCloseTo(0.9, 3);
  });
});

describe('generateSummary', () => {
  it('should include "合格" when passed is true', () => {
    const evaluations = [
      makeEvaluation({ personaName: 'SF愛好家', weightedScore: 0.9 }),
    ];
    const summary = generateSummary(evaluations, true);
    expect(summary).toContain('合格');
  });

  it('should include "不合格" when passed is false', () => {
    const evaluations = [
      makeEvaluation({ personaName: 'SF愛好家', weightedScore: 0.5 }),
    ];
    const summary = generateSummary(evaluations, false);
    expect(summary).toContain('不合格');
  });

  it('should include persona names and scores', () => {
    const evaluations = [
      makeEvaluation({ personaName: 'SF愛好家', weightedScore: 0.85 }),
      makeEvaluation({ personaName: '文学少女', weightedScore: 0.75 }),
    ];
    const summary = generateSummary(evaluations, true);

    expect(summary).toContain('SF愛好家');
    expect(summary).toContain('85.0');
    expect(summary).toContain('文学少女');
    expect(summary).toContain('75.0');
  });

  it('should include feedback for each persona', () => {
    const evaluations = [
      makeEvaluation({
        personaName: 'SF愛好家',
        weightedScore: 0.85,
        feedback: {
          strengths: '世界観が優秀',
          weaknesses: 'テンポが遅い',
          suggestion: '改善案',
        },
      }),
    ];
    const summary = generateSummary(evaluations, true);

    expect(summary).toContain('[良] 世界観が優秀');
    expect(summary).toContain('[課題] テンポが遅い');
    expect(summary).toContain('[提案] 改善案');
  });

  it('should handle empty evaluations', () => {
    const summary = generateSummary([], true);
    expect(summary).toContain('合格');
    expect(summary).toContain('各ペルソナの評価:');
  });
});
