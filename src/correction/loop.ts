import type { CorrectionLoopResult, Violation, ChapterContext, Corrector, ComplianceResult } from '../agents/types.js';

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
}

/**
 * FP CorrectionLoop interface
 */
export interface CorrectionRunner {
  run: (text: string, initialViolations?: Violation[], chapterContext?: ChapterContext) => Promise<CorrectionLoopResult>;
}

/**
 * Create a functional CorrectionLoop from dependencies
 */
export function createCorrectionLoop(deps: CorrectionLoopDeps): CorrectionRunner {
  const { corrector, checker, maxAttempts = DEFAULT_MAX_ATTEMPTS } = deps;

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

      while (attempts < maxAttempts) {
        attempts++;

        const correctionResult = await corrector.correct(currentText, currentViolations);
        totalTokensUsed += correctionResult.tokensUsed;
        currentText = correctionResult.correctedText;

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
