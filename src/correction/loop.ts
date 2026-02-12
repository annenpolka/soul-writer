import type { CorrectionLoopResult, Violation, ChapterContext, Corrector, ComplianceResult } from '../agents/types.js';
import type { LLMClient, LLMMessage } from '../llm/types.js';

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Checker interface for FP CorrectionLoop
 */
export interface CorrectionChecker {
  check: (text: string) => ComplianceResult;
  checkWithContext: (text: string, ctx: ChapterContext) => Promise<ComplianceResult>;
}

/**
 * Dependencies for functional CorrectionLoop
 */
export interface CorrectionLoopDeps {
  corrector: Corrector;
  checker: CorrectionChecker;
  maxAttempts?: number;
  /** Optional LLMClient for multi-turn correction (message accumulation across attempts) */
  llmClient?: LLMClient;
}

/**
 * FP CorrectionLoop interface
 */
export interface CorrectionRunner {
  run: (text: string, initialViolations?: Violation[], chapterContext?: ChapterContext) => Promise<CorrectionLoopResult>;
}

/**
 * Format violations for inclusion in user messages
 */
function formatViolations(violations: Violation[]): string {
  return violations
    .map(
      (v, i) =>
        `${i + 1}. [${v.type}] "${v.context}" - ${v.rule} (severity: ${v.severity})`
    )
    .join('\n');
}

/**
 * Create a functional CorrectionLoop from dependencies.
 * When llmClient is provided, uses multi-turn message accumulation
 * so the model can reference its own previous corrections.
 */
export function createCorrectionLoop(deps: CorrectionLoopDeps): CorrectionRunner {
  const { corrector, checker, maxAttempts = DEFAULT_MAX_ATTEMPTS, llmClient } = deps;

  async function checkText(text: string, chapterContext?: ChapterContext): Promise<ComplianceResult> {
    if (chapterContext) {
      return checker.checkWithContext(text, chapterContext);
    }
    return checker.check(text);
  }

  return {
    run: async (text: string, initialViolations?: Violation[], chapterContext?: ChapterContext): Promise<CorrectionLoopResult> => {
      const initialResult = await checkText(text, chapterContext);

      const mergedViolations = initialViolations
        ? [...initialResult.violations, ...initialViolations.filter(v => !initialResult.violations.some(sv => sv.type === v.type && sv.context === v.context))]
        : initialResult.violations;

      if (initialResult.isCompliant && mergedViolations.length === 0) {
        return {
          success: true,
          finalText: text,
          attempts: 0,
          totalTokensUsed: 0,
        };
      }

      let currentText = text;
      let currentViolations = mergedViolations;
      const originalViolations = [...mergedViolations];
      let attempts = 0;
      let totalTokensUsed = 0;

      // Multi-turn message accumulation state
      let conversationMessages: LLMMessage[] | undefined;

      while (attempts < maxAttempts) {
        attempts++;

        if (attempts === 1 || !llmClient) {
          // First attempt always uses corrector (or all attempts if no llmClient)
          const correctionResult = await corrector.correct(currentText, currentViolations);
          totalTokensUsed += correctionResult.tokensUsed;
          currentText = correctionResult.correctedText;

          // Initialize conversation messages for subsequent multi-turn calls
          if (llmClient && attempts === 1) {
            conversationMessages = [
              {
                role: 'system',
                content: 'あなたはテキスト矯正エージェントです。指摘された違反を修正し、修正後のテキスト全文のみを出力してください。',
              },
              {
                role: 'user',
                content: `以下のテキストに違反があります。修正してください。\n\n## 違反リスト\n${formatViolations(currentViolations)}\n\n## 対象テキスト\n${text}`,
              },
              {
                role: 'assistant',
                content: correctionResult.correctedText,
              },
            ];
          }
        } else {
          // Subsequent attempts: use accumulated messages
          conversationMessages!.push({
            role: 'user',
            content: `まだ以下の違反があります:\n${formatViolations(currentViolations)}\n\n上記の違反を修正してください。修正後のテキスト全文のみを出力してください。`,
          });

          const tokensBefore = llmClient.getTotalTokens();
          currentText = await llmClient.complete(conversationMessages!, { temperature: 1.0 });
          totalTokensUsed += llmClient.getTotalTokens() - tokensBefore;

          conversationMessages!.push({
            role: 'assistant',
            content: currentText,
          });
        }

        const checkResult = await checkText(currentText, chapterContext);

        if (checkResult.isCompliant) {
          return {
            success: true,
            finalText: currentText,
            attempts,
            totalTokensUsed,
          };
        }

        currentViolations = checkResult.violations;
      }

      return {
        success: false,
        finalText: currentText,
        attempts,
        totalTokensUsed,
        originalViolations,
      };
    },
  };
}
