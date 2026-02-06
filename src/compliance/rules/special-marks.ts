import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';

function checkSpecialMarks(mark: string, allowedForms: string[], text: string): Violation[] {
  const violations: Violation[] = [];

  if (!text || !mark) {
    return violations;
  }

  let index = text.indexOf(mark);

  while (index !== -1) {
    const isAllowed = allowedForms.some((form) => {
      const markIndexInForm = form.indexOf(mark);
      if (markIndexInForm === -1) return false;

      const expectedStart = index - markIndexInForm;
      if (expectedStart < 0 || expectedStart + form.length > text.length) return false;

      const candidate = text.slice(expectedStart, expectedStart + form.length);
      return candidate === form;
    });

    if (!isAllowed) {
      const contextStart = Math.max(0, index - 20);
      const contextEnd = Math.min(text.length, index + mark.length + 20);

      violations.push({
        type: 'special_mark_misuse',
        position: {
          start: index,
          end: index + mark.length,
        },
        context: text.slice(contextStart, contextEnd),
        rule: `Special mark "${mark}" must be used in approved forms: ${allowedForms.join(', ')}`,
        severity: 'error',
      });
    }

    index = text.indexOf(mark, index + 1);
  }

  return violations;
}

export function createSpecialMarksRule(mark: string, allowedForms: string[]): ComplianceRule {
  return {
    name: 'special_marks',
    check: (text) => checkSpecialMarks(mark, allowedForms, text),
  };
}

/**
 * SpecialMarksRule — adapter over createSpecialMarksRule() for backwards compatibility
 */
export class SpecialMarksRule implements ComplianceRule {
  readonly name = 'special_marks';
  private inner: ComplianceRule;

  constructor(mark: string, allowedForms: string[]) {
    this.inner = createSpecialMarksRule(mark, allowedForms);
  }

  check(text: string): Violation[] {
    return this.inner.check(text);
  }
}
