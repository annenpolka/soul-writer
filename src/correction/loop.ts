import type { CorrectorAgent } from '../agents/corrector.js';
import type { ComplianceChecker } from '../compliance/checker.js';
import type { CorrectionLoopResult, Violation, ChapterContext } from '../agents/types.js';

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * CorrectionLoop repeatedly attempts to fix violations until compliant or max attempts reached
 */
export class CorrectionLoop {
  private corrector: CorrectorAgent;
  private checker: ComplianceChecker;
  private maxAttempts: number;

  constructor(
    corrector: CorrectorAgent,
    checker: ComplianceChecker,
    maxAttempts: number = DEFAULT_MAX_ATTEMPTS
  ) {
    this.corrector = corrector;
    this.checker = checker;
    this.maxAttempts = maxAttempts;
  }

  private async checkText(text: string, chapterContext?: ChapterContext) {
    if (chapterContext) {
      return this.checker.checkWithContext(text, chapterContext);
    }
    return this.checker.check(text);
  }

  /**
   * Run the correction loop until text is compliant or max attempts reached
   */
  async run(text: string, initialViolations?: Violation[], chapterContext?: ChapterContext): Promise<CorrectionLoopResult> {
    // Initial compliance check (async if chapterContext provided)
    const initialResult = await this.checkText(text, chapterContext);

    // Merge initial violations (e.g. from caller's prior async check) with check result
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

    while (attempts < this.maxAttempts) {
      attempts++;

      // Attempt correction
      const correctionResult = await this.corrector.correct(currentText, currentViolations);
      totalTokensUsed += correctionResult.tokensUsed;
      currentText = correctionResult.correctedText;

      // Check compliance of corrected text (async if chapterContext provided)
      const checkResult = await this.checkText(currentText, chapterContext);

      if (checkResult.isCompliant) {
        return {
          success: true,
          finalText: currentText,
          attempts,
          totalTokensUsed,
        };
      }

      // Update violations for next iteration
      currentViolations = checkResult.violations;
    }

    // Max attempts reached without achieving compliance
    return {
      success: false,
      finalText: currentText,
      attempts,
      totalTokensUsed,
      originalViolations,
    };
  }
}
