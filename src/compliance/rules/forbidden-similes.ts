import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';

function checkForbiddenSimiles(forbiddenSimiles: string[], text: string): Violation[] {
  const violations: Violation[] = [];

  if (!text || forbiddenSimiles.length === 0) {
    return violations;
  }

  for (const simile of forbiddenSimiles) {
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

export function createForbiddenSimilesRule(forbiddenSimiles: string[]): ComplianceRule {
  return {
    name: 'forbidden_similes',
    check: (text) => checkForbiddenSimiles(forbiddenSimiles, text),
  };
}

/**
 * ForbiddenSimilesRule — adapter over createForbiddenSimilesRule() for backwards compatibility
 */
export class ForbiddenSimilesRule implements ComplianceRule {
  readonly name = 'forbidden_similes';
  private inner: ComplianceRule;

  constructor(forbiddenSimiles: string[]) {
    this.inner = createForbiddenSimilesRule(forbiddenSimiles);
  }

  check(text: string): Violation[] {
    return this.inner.check(text);
  }
}
