import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';

/**
 * Rule that checks for correct usage of special marks (e.g., × for killing)
 * Special marks must be used in approved forms only
 */
export class SpecialMarksRule implements ComplianceRule {
  readonly name = 'special_marks';
  private mark: string;
  private allowedForms: string[];

  constructor(mark: string, allowedForms: string[]) {
    this.mark = mark;
    this.allowedForms = allowedForms;
  }

  check(text: string): Violation[] {
    const violations: Violation[] = [];

    if (!text || !this.mark) {
      return violations;
    }

    // Find all occurrences of the special mark
    let index = text.indexOf(this.mark);

    while (index !== -1) {
      // Check if this occurrence is part of an allowed form
      const isAllowed = this.allowedForms.some((form) => {
        const markIndexInForm = form.indexOf(this.mark);
        if (markIndexInForm === -1) return false;

        // Reverse-calculate where the form should start if this mark is part of it
        const expectedStart = index - markIndexInForm;
        if (expectedStart < 0 || expectedStart + form.length > text.length) return false;

        const candidate = text.slice(expectedStart, expectedStart + form.length);
        return candidate === form;
      });

      if (!isAllowed) {
        const contextStart = Math.max(0, index - 20);
        const contextEnd = Math.min(text.length, index + this.mark.length + 20);

        violations.push({
          type: 'special_mark_misuse',
          position: {
            start: index,
            end: index + this.mark.length,
          },
          context: text.slice(contextStart, contextEnd),
          rule: `Special mark "${this.mark}" must be used in approved forms: ${this.allowedForms.join(', ')}`,
          severity: 'error',
        });
      }

      index = text.indexOf(this.mark, index + 1);
    }

    return violations;
  }
}
