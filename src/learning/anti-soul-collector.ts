import type { CorrectionLoopResult, Violation } from '../agents/types.js';
import type { AntiSoul } from '../schemas/anti-soul.js';

export interface AntiPattern {
  text: string;
  category: string;
  reason: string;
  source: 'auto' | 'manual';
}

/**
 * Collects anti-patterns from failed corrections for the anti-soul
 */
export class AntiSoulCollector {
  private violationMapping: Record<string, string>;
  private defaultCategory: string;

  constructor(antiSoul?: AntiSoul) {
    this.violationMapping = antiSoul?.violation_mapping ?? {};
    this.defaultCategory = antiSoul?.default_category ?? 'cliche_simile';
  }

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
   * Map a violation type to an anti-soul category using violation_mapping
   */
  mapViolationToCategory(violation: Violation): string {
    return this.violationMapping[violation.type] ?? this.defaultCategory;
  }
}
