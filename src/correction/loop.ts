import type { CorrectorAgent } from '../agents/corrector.js';
import type { ComplianceChecker } from '../compliance/checker.js';
import type { CorrectionLoopResult } from '../agents/types.js';

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

  /**
   * Run the correction loop until text is compliant or max attempts reached
   */
  async run(text: string): Promise<CorrectionLoopResult> {
    // Initial compliance check
    const initialResult = this.checker.check(text);

    if (initialResult.isCompliant) {
      return {
        success: true,
        finalText: text,
        attempts: 0,
        totalTokensUsed: 0,
      };
    }

    let currentText = text;
    let currentViolations = initialResult.violations;
    const originalViolations = [...initialResult.violations];
    let attempts = 0;
    let totalTokensUsed = 0;

    while (attempts < this.maxAttempts) {
      attempts++;

      // Attempt correction
      const correctionResult = await this.corrector.correct(currentText, currentViolations);
      totalTokensUsed += correctionResult.tokensUsed;
      currentText = correctionResult.correctedText;

      // Check compliance of corrected text
      const checkResult = this.checker.check(currentText);

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
