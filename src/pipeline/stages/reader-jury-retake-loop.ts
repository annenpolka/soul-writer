import type { PipelineStage } from '../types.js';

/**
 * Creates a pipeline stage that runs the reader jury evaluation with
 * a retake loop (max 2 retakes with feedback accumulation and score degradation detection).
 *
 * This combines:
 * 1. Initial reader jury evaluation
 * 2. Up to maxRetakes iterations of: feedback → retake → re-evaluate
 * 3. Score degradation rollback
 */
export function createReaderJuryRetakeLoopStage(maxRetakes: number = 2): PipelineStage {
  return async (ctx) => {
    const { createReaderJury } = await import('../../agents/reader-jury.js');
    const { createRetakeAgent } = await import('../../retake/retake-agent.js');
    const { createCheckerFromSoulText } = await import('../../compliance/checker.js');

    const readerJury = createReaderJury({ llmClient: ctx.deps.llmClient, soulText: ctx.deps.soulText });
    let readerJuryResult = await readerJury.evaluate(ctx.text, ctx.readerJuryResult);

    ctx.deps.logger?.debug('Reader Jury result', readerJuryResult);

    let finalText = ctx.text;
    let readerRetakeCount = 0;
    const feedbackHistory: string[] = [];

    const checker = createCheckerFromSoulText(ctx.deps.soulText, ctx.deps.narrativeRules);

    for (let i = 0; i < maxRetakes && !readerJuryResult.passed; i++) {
      ctx.deps.logger?.section?.(`Reader Jury Retake ${i + 1}/${maxRetakes}`);
      const prevScore = readerJuryResult.aggregatedScore;
      const prevText = finalText;
      const prevResult = readerJuryResult;

      const currentFeedback = readerJuryResult.evaluations
        .map((e) => `${e.personaName}:\n  [良] ${e.feedback.strengths}\n  [課題] ${e.feedback.weaknesses}\n  [提案] ${e.feedback.suggestion}`)
        .join('\n');
      feedbackHistory.push(currentFeedback);

      const feedbackMessage = feedbackHistory.length === 1
        ? `読者陪審員から以下のフィードバックを受けました。改善してください:\n${currentFeedback}`
        : `読者陪審員から複数回のフィードバックを受けています。前回の改善点も踏まえて修正してください:\n\n` +
          feedbackHistory.map((fb, idx) => `【第${idx + 1}回レビュー】\n${fb}`).join('\n\n');

      const retakeAgent = createRetakeAgent({
        llmClient: ctx.deps.llmClient,
        soulText: ctx.deps.soulText,
        narrativeRules: ctx.deps.narrativeRules,
        themeContext: ctx.deps.themeContext,
      });
      const retakeResult = await retakeAgent.retake(finalText, feedbackMessage);
      finalText = retakeResult.retakenText;
      readerJuryResult = await readerJury.evaluate(finalText, readerJuryResult);
      readerRetakeCount++;

      ctx.deps.logger?.debug?.(`Reader Jury Retake ${i + 1} result`, readerJuryResult);

      if (readerJuryResult.aggregatedScore <= prevScore) {
        ctx.deps.logger?.debug?.(`Reader Jury Retake aborted: score degraded (${prevScore.toFixed(3)} → ${readerJuryResult.aggregatedScore.toFixed(3)})`);
        finalText = prevText;
        readerJuryResult = prevResult;
        break;
      }
    }

    const complianceResult = checker.check(finalText);

    return {
      ...ctx,
      text: finalText,
      readerJuryResult,
      complianceResult,
      readerRetakeCount,
    };
  };
}
