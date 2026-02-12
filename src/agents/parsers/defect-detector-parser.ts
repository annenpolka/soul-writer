import type { StructuredResponse } from '../../llm/types.js';
import type { DefectDetectorResult, Defect, VerdictLevel } from '../types.js';
import type { DefectDetectorRawResponse } from '../../schemas/defect-detector-response.js';
import { isVerdictPassing } from '../../evaluation/verdict-utils.js';

/**
 * Parse a structured response into a DefectDetectorResult (pure function).
 */
export function parseDefectDetectorResponse(response: StructuredResponse<DefectDetectorRawResponse>): DefectDetectorResult {
  const data = response.data;
  const verdictLevel: VerdictLevel = data.verdict_level;

  const defects: Defect[] = data.defects.map((d) => ({
    severity: d.severity,
    category: d.category,
    description: d.description,
    ...(d.location ? { location: d.location } : {}),
    ...(d.quoted_text ? { quotedText: d.quoted_text } : {}),
    ...(d.suggested_fix ? { suggestedFix: d.suggested_fix } : {}),
  }));

  const criticalCount = defects.filter(d => d.severity === 'critical').length;
  const majorCount = defects.filter(d => d.severity === 'major').length;
  const minorCount = defects.filter(d => d.severity === 'minor').length;

  const passed = criticalCount === 0 && isVerdictPassing(verdictLevel);

  const feedback = defects.length === 0
    ? '欠陥なし'
    : defects.map(d => {
        let line = `[${d.severity}/${d.category}] ${d.description}`;
        if (d.quotedText) line += `\n  問題箇所: 「${d.quotedText}」`;
        if (d.suggestedFix) line += `\n  修正方向: ${d.suggestedFix}`;
        return line;
      }).join('\n\n');

  return {
    defects,
    criticalCount,
    majorCount,
    minorCount,
    verdictLevel,
    passed,
    feedback,
    llmReasoning: response.reasoning ?? null,
  };
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
    verdictLevel: 'needs_work',
    passed: false,
    feedback: 'パース失敗: structured outputの解析に失敗しました',
  };
}
