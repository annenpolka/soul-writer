import type { ToolCallResponse } from '../../llm/types.js';
import type { JudgeResult, ScoreBreakdown } from '../types.js';
import { parseToolArguments } from '../../llm/tooling.js';

/**
 * Parse a tool-call response into a JudgeResult (pure function).
 */
export function parseJudgeResponse(response: ToolCallResponse): JudgeResult {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_judgement');
  } catch (e) {
    console.warn('[judge-parser] Tool call parsing failed, using fallback result:', e instanceof Error ? e.message : e);
    return createFallbackResult();
  }

  try {
    const candidate = parsed as {
      winner?: string;
      reasoning?: string;
      scores?: { A?: Partial<ScoreBreakdown>; B?: Partial<ScoreBreakdown> };
      praised_excerpts?: { A?: unknown; B?: unknown };
    };
    return {
      winner: candidate.winner === 'B' ? 'B' : 'A',
      reasoning: candidate.reasoning || 'No reasoning provided',
      scores: {
        A: normalizeScore(candidate.scores?.A),
        B: normalizeScore(candidate.scores?.B),
      },
      praised_excerpts: {
        A: Array.isArray(candidate.praised_excerpts?.A) ? candidate.praised_excerpts?.A as string[] : [],
        B: Array.isArray(candidate.praised_excerpts?.B) ? candidate.praised_excerpts?.B as string[] : [],
      },
    };
  } catch (e) {
    console.warn('[judge-parser] Response structure parsing failed, using fallback result:', e instanceof Error ? e.message : e);
    return createFallbackResult();
  }
}

/**
 * Normalize a score breakdown by clamping all values to [0.05, 0.95] (pure function).
 */
export function normalizeScore(score: Partial<ScoreBreakdown> | undefined): ScoreBreakdown {
  const clamp = (v: number | undefined) => {
    const val = v ?? 0.5;
    return Math.min(0.95, Math.max(0.05, val));
  };
  return {
    style: clamp(score?.style),
    compliance: clamp(score?.compliance),
    voice_accuracy: clamp(score?.voice_accuracy),
    originality_fidelity: clamp(score?.originality_fidelity),
    narrative_quality: clamp(score?.narrative_quality),
    novelty: clamp(score?.novelty),
    overall: clamp(score?.overall),
  };
}

/**
 * Create a fallback JudgeResult when parsing fails (pure function).
 */
export function createFallbackResult(): JudgeResult {
  return {
    winner: 'A',
    reasoning: 'Fallback: tool call parsing failed',
    scores: {
      A: { style: 0.5, compliance: 0.5, voice_accuracy: 0.5, originality_fidelity: 0.5, narrative_quality: 0.5, novelty: 0.5, overall: 0.5 },
      B: { style: 0.5, compliance: 0.5, voice_accuracy: 0.5, originality_fidelity: 0.5, narrative_quality: 0.5, novelty: 0.5, overall: 0.5 },
    },
  };
}
