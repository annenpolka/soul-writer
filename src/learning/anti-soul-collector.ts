import type { CorrectionLoopResult, Violation } from '../agents/types.js';
import type { AntiSoul } from '../schemas/anti-soul.js';

export interface AntiPattern {
  text: string;
  category: string;
  reason: string;
  source: 'auto' | 'manual';
}

export interface AntiSoulCollectorFn {
  collectFromFailedCorrection(result: CorrectionLoopResult): AntiPattern[];
  mapViolationToCategory(violation: Violation): string;
}

export function createAntiSoulCollector(antiSoul?: AntiSoul): AntiSoulCollectorFn {
  const violationMapping = antiSoul?.violation_mapping ?? {};
  const defaultCategory = antiSoul?.default_category ?? 'cliche_simile';

  return {
    collectFromFailedCorrection(result: CorrectionLoopResult): AntiPattern[] {
      if (result.success || !result.originalViolations) {
        return [];
      }

      return result.originalViolations.map((violation) => ({
        text: violation.context,
        category: violationMapping[violation.type] ?? defaultCategory,
        reason: violation.rule,
        source: 'auto' as const,
      }));
    },

    mapViolationToCategory(violation: Violation): string {
      return violationMapping[violation.type] ?? defaultCategory;
    },
  };
}

