import type { DefectDetectorResult, ReaderJuryResult } from '../../agents/types.js';

export function defectResultToReaderJuryResult(result: DefectDetectorResult): ReaderJuryResult {
  const score = Math.max(0, 1.0 - (result.criticalCount * 0.3 + result.majorCount * 0.1 + result.minorCount * 0.02));
  return {
    evaluations: [],
    aggregatedScore: score,
    passed: result.passed,
    summary: result.feedback,
  };
}
