import type { PersonaEvaluation } from '../types.js';

/**
 * Calculate the aggregated score as the mean of all weighted scores (pure function).
 * Equivalent to ReaderJuryAgent.calculateAggregatedScore().
 */
export function calculateAggregatedScore(evaluations: PersonaEvaluation[]): number {
  if (evaluations.length === 0) return 0;
  const sum = evaluations.reduce((acc, e) => acc + e.weightedScore, 0);
  return sum / evaluations.length;
}

/**
 * Generate a human-readable summary of evaluations (pure function).
 * Equivalent to ReaderJuryAgent.generateSummary().
 */
export function generateSummary(
  evaluations: PersonaEvaluation[],
  passed: boolean,
): string {
  const parts: string[] = [];

  if (passed) {
    parts.push('読者陪審員の評価: 合格');
  } else {
    parts.push('読者陪審員の評価: 不合格');
  }

  parts.push('');
  parts.push('各ペルソナの評価:');

  for (const evaluation of evaluations) {
    const score = (evaluation.weightedScore * 100).toFixed(1);
    parts.push(`- ${evaluation.personaName}: ${score}点`);
    parts.push(`  [良] ${evaluation.feedback.strengths}`);
    parts.push(`  [課題] ${evaluation.feedback.weaknesses}`);
    parts.push(`  [提案] ${evaluation.feedback.suggestion}`);
  }

  return parts.join('\n');
}
