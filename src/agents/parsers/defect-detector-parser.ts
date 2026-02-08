import type { ToolCallResponse } from '../../llm/types.js';
import type { DefectDetectorResult, Defect, DefectSeverity } from '../types.js';
import { parseToolArguments } from '../../llm/tooling.js';

const VALID_SEVERITIES: Set<string> = new Set(['critical', 'major', 'minor']);

/**
 * Parse a tool-call response into a DefectDetectorResult (pure function).
 */
export function parseDefectDetectorResponse(response: ToolCallResponse): DefectDetectorResult {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_defects');
  } catch (e) {
    console.warn('[defect-detector-parser] Tool call parsing failed:', e instanceof Error ? e.message : e);
    return createFallbackResult();
  }

  try {
    const candidate = parsed as { defects?: unknown[] };
    const rawDefects = Array.isArray(candidate.defects) ? candidate.defects : [];

    // Filter and validate defects
    const defects: Defect[] = rawDefects
      .filter((d): d is Record<string, unknown> =>
        typeof d === 'object' && d !== null &&
        typeof (d as Record<string, unknown>).severity === 'string' &&
        VALID_SEVERITIES.has((d as Record<string, unknown>).severity as string)
      )
      .map((d) => ({
        severity: d.severity as DefectSeverity,
        category: String(d.category ?? ''),
        description: String(d.description ?? ''),
        ...(d.location ? { location: String(d.location) } : {}),
      }));

    const criticalCount = defects.filter(d => d.severity === 'critical').length;
    const majorCount = defects.filter(d => d.severity === 'major').length;
    const minorCount = defects.filter(d => d.severity === 'minor').length;

    // Default pass criteria: no critical defects
    const passed = criticalCount === 0;

    const feedback = defects.length === 0
      ? '欠陥なし'
      : defects.map(d => `[${d.severity}] ${d.description}`).join('; ');

    return {
      defects,
      criticalCount,
      majorCount,
      minorCount,
      passed,
      feedback,
    };
  } catch (e) {
    console.warn('[defect-detector-parser] Response structure parsing failed:', e instanceof Error ? e.message : e);
    return createFallbackResult();
  }
}

/**
 * Create a fallback DefectDetectorResult when parsing fails (pure function).
 */
export function createFallbackResult(): DefectDetectorResult {
  return {
    defects: [],
    criticalCount: 0,
    majorCount: 0,
    minorCount: 0,
    passed: true,
    feedback: 'パース失敗: ツールコールの解析に失敗しました',
  };
}
