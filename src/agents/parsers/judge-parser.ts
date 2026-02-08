import type { ToolCallResponse } from '../../llm/types.js';
import type { JudgeResult, ScoreBreakdown, TextWeakness, AxisComment, SectionAnalysis } from '../types.js';
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
      weaknesses?: unknown;
      axis_comments?: unknown;
      section_analysis?: unknown;
    };
    const result: JudgeResult = {
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

    const weaknesses = parseWeaknesses(candidate.weaknesses);
    if (weaknesses) result.weaknesses = weaknesses;

    const axisComments = parseAxisComments(candidate.axis_comments);
    if (axisComments) result.axis_comments = axisComments;

    const sectionAnalysis = parseSectionAnalysis(candidate.section_analysis);
    if (sectionAnalysis) result.section_analysis = sectionAnalysis;

    return result;
  } catch (e) {
    console.warn('[judge-parser] Response structure parsing failed, using fallback result:', e instanceof Error ? e.message : e);
    return createFallbackResult();
  }
}

/**
 * Parse weaknesses field (pure function).
 */
function parseWeaknesses(raw: unknown): { A: TextWeakness[]; B: TextWeakness[] } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as { A?: unknown; B?: unknown };
  if (!Array.isArray(obj.A) || !Array.isArray(obj.B)) return undefined;
  return { A: obj.A as TextWeakness[], B: obj.B as TextWeakness[] };
}

/**
 * Parse axis_comments field (pure function).
 */
function parseAxisComments(raw: unknown): AxisComment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw as AxisComment[];
}

/**
 * Parse section_analysis field (pure function).
 */
function parseSectionAnalysis(raw: unknown): SectionAnalysis[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw as SectionAnalysis[];
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
    reasoning: 'Fallback: tool call parsing failed',
    scores: {
      A: { style: 0.5, compliance: 0.5, voice_accuracy: 0.5, originality: 0.5, structure: 0.5, amplitude: 0.5, agency: 0.5, stakes: 0.5, overall: 0.5 },
      B: { style: 0.5, compliance: 0.5, voice_accuracy: 0.5, originality: 0.5, structure: 0.5, amplitude: 0.5, agency: 0.5, stakes: 0.5, overall: 0.5 },
    },
  };
}
