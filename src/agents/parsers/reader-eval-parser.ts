import type { ToolCallResponse } from '../../llm/types.js';
import type { CategoryScores, PersonaEvaluation, PersonaFeedback } from '../types.js';
import type { ReaderPersona } from '../../schemas/reader-personas.js';
import { parseToolArguments } from '../../llm/tooling.js';

/**
 * Clamp a score to [0, 1], defaulting undefined/NaN to 0.5 (pure function).
 * Equivalent to ReaderEvaluator.clampScore().
 */
export function clampScore(score: number | undefined): number {
  if (score === undefined || isNaN(score)) return 0.5;
  return Math.max(0, Math.min(1, score));
}

/**
 * Return default category scores (all 0.5) (pure function).
 * Equivalent to ReaderEvaluator.getDefaultScores().
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
 * Equivalent to ReaderEvaluator.normalizeScores().
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
 * Equivalent to ReaderEvaluator.calculateWeightedScore().
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
 * Parse a tool-call response into a PersonaEvaluation (pure function).
 * Equivalent to ReaderEvaluator.parseToolResponse().
 */
export function parseEvalToolResponse(
  response: ToolCallResponse,
  persona: ReaderPersona,
): PersonaEvaluation {
  let categoryScores: CategoryScores;
  let feedback: PersonaFeedback;

  const defaultFeedback: PersonaFeedback = {
    strengths: '',
    weaknesses: '',
    suggestion: '',
  };

  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_reader_evaluation');
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === 'object') {
    const candidate = parsed as {
      categoryScores?: Partial<CategoryScores>;
      feedback?: Partial<PersonaFeedback> | string;
    };
    categoryScores = normalizeScores(candidate.categoryScores);
    if (candidate.feedback && typeof candidate.feedback === 'object') {
      const fb = candidate.feedback as Partial<PersonaFeedback>;
      feedback = {
        strengths: fb.strengths || '',
        weaknesses: fb.weaknesses || '',
        suggestion: fb.suggestion || '',
      };
    } else {
      feedback = {
        ...defaultFeedback,
        strengths: typeof candidate.feedback === 'string' ? candidate.feedback : 'フィードバックなし',
      };
    }
  } else {
    categoryScores = getDefaultScores();
    feedback = { ...defaultFeedback, weaknesses: 'ツール呼び出しの解析に失敗' };
  }

  const weightedScore = calculateWeightedScore(categoryScores, persona.evaluation_weights);

  return {
    personaId: persona.id,
    personaName: persona.name,
    categoryScores,
    weightedScore,
    feedback,
  };
}
