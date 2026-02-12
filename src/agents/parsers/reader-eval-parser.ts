import type { StructuredResponse } from '../../llm/types.js';
import type { CategoryScores, PersonaEvaluation, PersonaFeedback } from '../types.js';
import type { ReaderPersona } from '../../schemas/reader-personas.js';
import type { ReaderEvaluationRawResponse } from '../../schemas/reader-evaluation-response.js';

/**
 * Clamp a score to [0, 1], defaulting undefined/NaN to 0.5 (pure function).
 */
export function clampScore(score: number | undefined): number {
  if (score === undefined || isNaN(score)) return 0.5;
  return Math.max(0, Math.min(1, score));
}

/**
 * Return default category scores (all 0.5) (pure function).
 */
export function getDefaultScores(): CategoryScores {
  return {
    style: 0.5,
    plot: 0.5,
    character: 0.5,
    worldbuilding: 0.5,
    readability: 0.5,
  };
}

/**
 * Normalize partial scores into a complete CategoryScores (pure function).
 */
export function normalizeScores(
  scores: Partial<CategoryScores> | undefined,
): CategoryScores {
  return {
    style: clampScore(scores?.style),
    plot: clampScore(scores?.plot),
    character: clampScore(scores?.character),
    worldbuilding: clampScore(scores?.worldbuilding),
    readability: clampScore(scores?.readability),
  };
}

/**
 * Calculate weighted score from category scores and persona weights (pure function).
 */
export function calculateWeightedScore(
  scores: CategoryScores,
  weights: ReaderPersona['evaluation_weights'],
): number {
  return (
    scores.style * weights.style +
    scores.plot * weights.plot +
    scores.character * weights.character +
    scores.worldbuilding * weights.worldbuilding +
    scores.readability * weights.readability
  );
}

/**
 * Parse a structured response into a PersonaEvaluation (pure function).
 */
export function parseEvalToolResponse(
  response: StructuredResponse<ReaderEvaluationRawResponse>,
  persona: ReaderPersona,
): PersonaEvaluation {
  const data = response.data;
  const categoryScores = normalizeScores(data.categoryScores);
  const feedback: PersonaFeedback = {
    strengths: data.feedback.strengths || '',
    weaknesses: data.feedback.weaknesses || '',
    suggestion: data.feedback.suggestion || '',
  };

  const weightedScore = calculateWeightedScore(categoryScores, persona.evaluation_weights);

  return {
    personaId: persona.id,
    personaName: persona.name,
    categoryScores,
    weightedScore,
    feedback,
  };
}
