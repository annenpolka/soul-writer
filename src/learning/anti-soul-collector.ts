import type { CorrectionLoopResult, Violation } from '../agents/types.js';

export type AntiSoulCategory =
  | 'theme_violation'
  | 'excessive_sentiment'
  | 'explanatory_worldbuilding'
  | 'character_normalization'
  | 'cliche_simile';

export interface AntiPattern {
  text: string;
  category: AntiSoulCategory;
  reason: string;
  source: 'auto' | 'manual';
}

/**
 * Collects anti-patterns from failed corrections for the anti-soul
 */
export class AntiSoulCollector {
  /**
   * Extract anti-patterns from a failed correction loop
   */
  collectFromFailedCorrection(result: CorrectionLoopResult): AntiPattern[] {
    if (result.success || !result.originalViolations) {
      return [];
    }

    return result.originalViolations.map((violation) => ({
      text: violation.context,
      category: this.mapViolationToCategory(violation),
      reason: violation.rule,
      source: 'auto' as const,
    }));
  }

  /**
   * Map a violation type to an anti-soul category
   */
  mapViolationToCategory(violation: Violation): AntiSoulCategory {
    switch (violation.type) {
      case 'theme_violation':
        return 'theme_violation';
      case 'forbidden_word':
      case 'forbidden_simile':
        return 'cliche_simile';
      case 'sentence_too_long':
        return 'excessive_sentiment';
      case 'special_mark_misuse':
        return 'character_normalization';
      default:
        return 'cliche_simile';
    }
  }
}
