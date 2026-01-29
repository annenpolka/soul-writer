import type { RetakeAgent } from './retake-agent.js';
import type { JudgeAgent } from '../agents/judge.js';

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
 * RetakeLoop evaluates tournament winner and retakes if quality is below threshold.
 * Each retake is evaluated against the previous version by the Judge.
 * If the retake is worse, it rolls back to the previous version.
 */
export class RetakeLoop {
  private retakeAgent: RetakeAgent;
  private judgeAgent: JudgeAgent;
  private config: RetakeLoopConfig;

  constructor(
    retakeAgent: RetakeAgent,
    judgeAgent: JudgeAgent,
    config: RetakeLoopConfig = DEFAULT_RETAKE_CONFIG
  ) {
    this.retakeAgent = retakeAgent;
    this.judgeAgent = judgeAgent;
    this.config = config;
  }

  async run(text: string, initialFeedback?: string): Promise<RetakeLoopResult> {
    let currentText = text;
    let retakeCount = 0;
    let totalTokensUsed = 0;
    let improved = false;
    let lastScore: number | undefined;

    for (let i = 0; i < this.config.maxRetakes; i++) {
      // Evaluate current text quality by having judge compare it against itself
      // (We use the judge's scoring to determine if retake is needed)
      const needsRetake = await this.needsRetake(currentText);
      if (!needsRetake.needed) {
        lastScore = needsRetake.score;
        break;
      }

      // Build feedback from evaluation
      const feedback = initialFeedback && i === 0
        ? initialFeedback
        : needsRetake.feedback;

      // Perform retake
      const retakeResult = await this.retakeAgent.retake(currentText, feedback);
      totalTokensUsed += retakeResult.tokensUsed;
      retakeCount++;

      // Compare retake against original using Judge
      const comparison = await this.judgeAgent.evaluate(currentText, retakeResult.retakenText);
      totalTokensUsed += 0; // Judge tokens are tracked separately

      if (comparison.winner === 'B') {
        // Retake is better, adopt it
        currentText = retakeResult.retakenText;
        improved = true;
        lastScore = comparison.scores.B.overall;
      } else {
        // Retake is worse, keep current and stop
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
  }

  private async needsRetake(text: string): Promise<{ needed: boolean; score: number; feedback: string }> {
    // Use a self-evaluation: judge compares text against an "ideal" standard
    // by examining the text alone and scoring it
    // We leverage the judge by comparing text with itself - scoring reveals quality
    const result = await this.judgeAgent.evaluate(text, text);
    const score = result.scores.A.overall;
    const voiceScore = result.scores.A.voice_accuracy ?? 0.5;

    const feedbackParts: string[] = [];
    if (voiceScore < this.config.minVoiceThreshold) {
      feedbackParts.push('語り声の再現度が低い。「わたし」の冷徹で乾いた一人称視点を徹底すること。');
    }
    if ((result.scores.A.style ?? 0.5) < 0.6) {
      feedbackParts.push('文体のリズムが原作と異なる。短-短-長-短のリズムを意識すること。');
    }
    if ((result.scores.A.originality_fidelity ?? 0.5) < 0.6) {
      feedbackParts.push('原作の設定やキャラクターから逸脱している。捏造を排除すること。');
    }
    if ((result.scores.A.compliance ?? 0.5) < 0.6) {
      feedbackParts.push('禁止語彙・禁止比喩が含まれている。');
    }

    const needed = score < this.config.minScoreThreshold || voiceScore < this.config.minVoiceThreshold;
    const feedback = feedbackParts.length > 0
      ? feedbackParts.join('\n')
      : '全体的な品質を向上させてください。';

    return { needed, score, feedback };
  }
}
