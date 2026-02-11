import type { EvaluationResult } from '../../agents/types.js';
import type { PipelineStage } from '../types.js';
import { defectResultToReaderJuryResult } from '../adapters/defect-to-reader.js';
import { buildRetakeFeedback } from '../../evaluation/verdict-utils.js';

export function createDefectDetectorStage(): PipelineStage {
  return async (ctx) => {
    const { createDefectDetector } = await import('../../agents/defect-detector.js');

    // Extract compliance warnings for DefectDetector
    const complianceWarnings = ctx.complianceResult?.violations.filter(v => v.severity === 'warning');

    const detector = createDefectDetector({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
      enrichedCharacters: ctx.deps.enrichedCharacters,
      crossChapterState: ctx.deps.crossChapterState,
      complianceWarnings,
    });

    let defectResult = await detector.detect(ctx.text);
    let finalText = ctx.text;

    // If failed, retake up to 2 times with enriched context
    const MAX_RETAKES = 2;
    let retakeCount = 0;

    while (!defectResult.passed && retakeCount < MAX_RETAKES) {
      const { createRetakeAgent } = await import('../../retake/retake-agent.js');

      const feedback = buildRetakeFeedback(
        defectResult.defects,
        [],
        defectResult.verdictLevel,
      );

      // Extract plot chapter info from chapterContext if available
      const plotChapter = extractPlotChapter(ctx);

      const retaker = createRetakeAgent({
        llmClient: ctx.deps.llmClient,
        soulText: ctx.deps.soulText,
        narrativeRules: ctx.deps.narrativeRules,
        themeContext: ctx.deps.themeContext,
        chapterContext: ctx.chapterContext,
        plotChapter,
      });

      const retakeResult = await retaker.retake(finalText, feedback, defectResult.defects);
      finalText = retakeResult.retakenText;
      defectResult = await detector.detect(finalText);
      retakeCount++;
    }

    // Build EvaluationResult
    const evaluationResult: EvaluationResult = {
      defects: defectResult.defects,
      criticalCount: defectResult.criticalCount,
      majorCount: defectResult.majorCount,
      minorCount: defectResult.minorCount,
      verdictLevel: defectResult.verdictLevel,
      passed: defectResult.passed,
      needsRetake: !defectResult.passed,
      feedback: defectResult.feedback,
    };

    return {
      ...ctx,
      text: finalText,
      defectResult,
      evaluationResult,
      readerJuryResult: defectResultToReaderJuryResult(defectResult),
    };
  };
}

/**
 * Extract plot chapter info from pipeline context for retake enrichment.
 */
function extractPlotChapter(ctx: Parameters<PipelineStage>[0]) {
  const chapter = ctx.chapterContext as { currentChapter?: { summary?: string; key_events?: string[]; decision_point?: { action: string; stakes: string; irreversibility: string } } } | undefined;
  const current = chapter?.currentChapter;
  if (!current?.summary) return undefined;

  return {
    summary: current.summary,
    keyEvents: current.key_events ?? [],
    decisionPoint: current.decision_point,
  };
}
