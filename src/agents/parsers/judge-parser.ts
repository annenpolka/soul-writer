import type { StructuredResponse } from '../../llm/types.js';
import type { JudgeResult, ScoreBreakdown } from '../types.js';
import type { JudgeRawResponse } from '../../schemas/judge-response.js';

/**
 * Parse a structured response into a JudgeResult (pure function).
 */
export function parseJudgeResponse(response: StructuredResponse<JudgeRawResponse>): JudgeResult {
  const data = response.data;

  const result: JudgeResult = {
    winner: data.winner,
    reasoning: data.reasoning || 'No reasoning provided',
    scores: {
      A: normalizeScore(data.scores.A),
      B: normalizeScore(data.scores.B),
    },
    praised_excerpts: data.praised_excerpts ?? { A: [], B: [] },
    llmReasoning: response.reasoning ?? null,
  };

  if (data.weaknesses) result.weaknesses = data.weaknesses;
  if (data.axis_comments) result.axis_comments = data.axis_comments;
  if (data.section_analysis) result.section_analysis = data.section_analysis;

  return result;
}

/**
 * Normalize a score breakdown by clamping all values to [0.05, 0.95] (pure function).
 */
export function normalizeScore(score: Partial<ScoreBreakdown> | undefined): ScoreBreakdown {
  const clamp = (v: number | undefined) => {
    const val = v ?? 0.5;
    return Math.min(0.95, Math.max(0.05, val));
  };
  // Backward-compatible: read from old field names if new ones are missing
  const legacy = score as Record<string, unknown> | undefined;
  return {
    style: clamp(score?.style),
    compliance: clamp(score?.compliance),
    voice_accuracy: clamp(score?.voice_accuracy),
    originality: clamp(score?.originality ?? (legacy?.originality_fidelity as number | undefined)),
    structure: clamp(score?.structure ?? (legacy?.narrative_quality as number | undefined)),
    amplitude: clamp(score?.amplitude),
    agency: clamp(score?.agency),
    stakes: clamp(score?.stakes),
    overall: clamp(score?.overall),
  };
}

/**
 * Create a fallback JudgeResult when parsing fails (pure function).
 */
export function createFallbackResult(): JudgeResult {
  return {
    winner: 'A',
    reasoning: 'Fallback: structured output parsing failed',
    scores: {
      A: { style: 0.5, compliance: 0.5, voice_accuracy: 0.5, originality: 0.5, structure: 0.5, amplitude: 0.5, agency: 0.5, stakes: 0.5, overall: 0.5 },
      B: { style: 0.5, compliance: 0.5, voice_accuracy: 0.5, originality: 0.5, structure: 0.5, amplitude: 0.5, agency: 0.5, stakes: 0.5, overall: 0.5 },
    },
  };
}
