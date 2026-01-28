import type { Violation } from '../../agents/types.js';

/**
 * Interface for compliance rules
 */
export interface ComplianceRule {
  name: string;
  check(text: string): Violation[];
}

/**
 * Rule that detects forbidden words in text
 */
export class ForbiddenWordsRule implements ComplianceRule {
  readonly name = 'forbidden_words';
  private forbiddenWords: string[];

  constructor(forbiddenWords: string[]) {
    this.forbiddenWords = forbiddenWords;
  }

  check(text: string): Violation[] {
    const violations: Violation[] = [];

    if (!text || this.forbiddenWords.length === 0) {
      return violations;
    }

    for (const word of this.forbiddenWords) {
      let index = text.indexOf(word);

      while (index !== -1) {
        const contextStart = Math.max(0, index - 20);
        const contextEnd = Math.min(text.length, index + word.length + 20);

        violations.push({
          type: 'forbidden_word',
          position: {
            start: index,
            end: index + word.length,
          },
          context: text.slice(contextStart, contextEnd),
          rule: `Forbidden word: "${word}"`,
          severity: 'error',
        });

        index = text.indexOf(word, index + 1);
      }
    }

    return violations;
  }
}
