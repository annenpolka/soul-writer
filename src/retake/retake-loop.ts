import type { Retaker, Judge } from '../agents/types.js';

export interface RetakeLoopConfig {
  maxRetakes: number;
  /** Minimum overall score to skip retake */
  minScoreThreshold: number;
  /** Minimum voice_accuracy score to skip retake */
  minVoiceThreshold: number;
}

export const DEFAULT_RETAKE_CONFIG: RetakeLoopConfig = {
  maxRetakes: 2,
  minScoreThreshold: 0.7,
  minVoiceThreshold: 0.6,
};

export interface RetakeLoopResult {
  finalText: string;
  retakeCount: number;
  improved: boolean;
  totalTokensUsed: number;
  finalScore?: number;
}

/**
 * Dependencies for functional RetakeLoop
 */
export interface RetakeLoopDeps {
  retaker: Retaker;
  judge: Judge;
  config?: RetakeLoopConfig;
}

/**
 * FP RetakeLoop interface
 */
export interface RetakeRunner {
  run: (text: string, initialFeedback?: string) => Promise<RetakeLoopResult>;
}

function buildFeedback(scores: import('../agents/types.js').ScoreBreakdown, minVoiceThreshold: number): string {
  const voiceScore = scores.voice_accuracy ?? 0.5;
  const feedbackParts: string[] = [];

  if (voiceScore < minVoiceThreshold) {
    feedbackParts.push('語り声の再現度が低い。冷徹で乾いた語り口を徹底すること。');
  }
  if ((scores.style ?? 0.5) < 0.6) {
    feedbackParts.push('文体のリズムが原作と異なる。短-短-長-短のリズムを意識すること。');
  }
  if ((scores.originality ?? 0.5) < 0.6) {
    feedbackParts.push('原作の精神を独自に拡張するアプローチが不足している。');
  }
  if ((scores.compliance ?? 0.5) < 0.6) {
    feedbackParts.push('禁止語彙・禁止比喩が含まれている。');
  }

  return feedbackParts.length > 0
    ? feedbackParts.join('\n')
    : '全体的な品質を向上させてください。';
}

/**
 * Create a functional RetakeLoop from dependencies
 */
export function createRetakeLoop(deps: RetakeLoopDeps): RetakeRunner {
  const { retaker, judge, config = DEFAULT_RETAKE_CONFIG } = deps;

  async function needsRetake(text: string): Promise<{ needed: boolean; score: number; feedback: string }> {
    const result = await judge.evaluate(text, text);
    const score = result.scores.A.overall;
    const voiceScore = result.scores.A.voice_accuracy ?? 0.5;

    const feedback = buildFeedback(result.scores.A, config.minVoiceThreshold);
    const needed = score < config.minScoreThreshold || voiceScore < config.minVoiceThreshold;

    return { needed, score, feedback };
  }

  return {
    run: async (text: string, initialFeedback?: string): Promise<RetakeLoopResult> => {
      let currentText = text;
      let retakeCount = 0;
      let totalTokensUsed = 0;
      let improved = false;
      let lastScore: number | undefined;

      for (let i = 0; i < config.maxRetakes; i++) {
        const retakeCheck = await needsRetake(currentText);
        if (!retakeCheck.needed) {
          lastScore = retakeCheck.score;
          break;
        }

        const feedback = initialFeedback && i === 0
          ? initialFeedback
          : retakeCheck.feedback;

        const retakeResult = await retaker.retake(currentText, feedback);
        totalTokensUsed += retakeResult.tokensUsed;
        retakeCount++;

        const comparison = await judge.evaluate(currentText, retakeResult.retakenText);

        if (comparison.winner === 'B') {
          currentText = retakeResult.retakenText;
          improved = true;
          lastScore = comparison.scores.B.overall;
        } else {
          lastScore = comparison.scores.A.overall;
          break;
        }
      }

      return {
        finalText: currentText,
        retakeCount,
        improved,
        totalTokensUsed,
        finalScore: lastScore,
      };
    },
  };
}
