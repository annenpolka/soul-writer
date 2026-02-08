import type { PipelineStage } from '../types.js';
import { defectResultToReaderJuryResult } from '../adapters/defect-to-reader.js';

export function createDefectDetectorStage(): PipelineStage {
  return async (ctx) => {
    const { createDefectDetector } = await import('../../agents/defect-detector.js');
    const detector = createDefectDetector({
      llmClient: ctx.deps.llmClient,
      soulText: ctx.deps.soulText,
    });

    let defectResult = await detector.detect(ctx.text);
    let finalText = ctx.text;

    // If failed, retake once and re-detect
    if (!defectResult.passed) {
      const { createRetakeAgent } = await import('../../retake/retake-agent.js');
      const retaker = createRetakeAgent({
        llmClient: ctx.deps.llmClient,
        soulText: ctx.deps.soulText,
        narrativeRules: ctx.deps.narrativeRules,
        themeContext: ctx.deps.themeContext,
      });

      const retakeResult = await retaker.retake(finalText, defectResult.feedback);
      finalText = retakeResult.retakenText;
      defectResult = await detector.detect(finalText);
    }

    return {
      ...ctx,
      text: finalText,
      defectResult,
      readerJuryResult: defectResultToReaderJuryResult(defectResult),
    };
  };
}
