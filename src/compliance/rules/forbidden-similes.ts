import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';

/**
 * Rule that detects forbidden similes in text
 */
export class ForbiddenSimilesRule implements ComplianceRule {
  readonly name = 'forbidden_similes';
  private forbiddenSimiles: string[];

  constructor(forbiddenSimiles: string[]) {
    this.forbiddenSimiles = forbiddenSimiles;
  }

  check(text: string): Violation[] {
    const violations: Violation[] = [];

    if (!text || this.forbiddenSimiles.length === 0) {
      return violations;
    }

    for (const simile of this.forbiddenSimiles) {
      let index = text.indexOf(simile);

      while (index !== -1) {
        const contextStart = Math.max(0, index - 20);
        const contextEnd = Math.min(text.length, index + simile.length + 20);

        violations.push({
          type: 'forbidden_simile',
          position: {
            start: index,
            end: index + simile.length,
          },
          context: text.slice(contextStart, contextEnd),
          rule: `Forbidden simile: "${simile}"`,
          severity: 'error',
        });

        index = text.indexOf(simile, index + 1);
      }
    }

    return violations;
  }
}
