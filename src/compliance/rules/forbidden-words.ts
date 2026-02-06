import type { Violation } from '../../agents/types.js';

/**
 * Interface for compliance rules
 */
export interface ComplianceRule {
  name: string;
  check(text: string): Violation[];
}

function checkForbiddenWords(forbiddenWords: string[], text: string): Violation[] {
  const violations: Violation[] = [];

  if (!text || forbiddenWords.length === 0) {
    return violations;
  }

  for (const word of forbiddenWords) {
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

export function createForbiddenWordsRule(forbiddenWords: string[]): ComplianceRule {
  return {
    name: 'forbidden_words',
    check: (text) => checkForbiddenWords(forbiddenWords, text),
  };
}

/**
 * ForbiddenWordsRule — adapter over createForbiddenWordsRule() for backwards compatibility
 */
export class ForbiddenWordsRule implements ComplianceRule {
  readonly name = 'forbidden_words';
  private inner: ComplianceRule;

  constructor(forbiddenWords: string[]) {
    this.inner = createForbiddenWordsRule(forbiddenWords);
  }

  check(text: string): Violation[] {
    return this.inner.check(text);
  }
}
