import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';
import type { Fragment } from '../../schemas/fragments.js';

/**
 * Rule that detects direct quotes from source fragments in generated text.
 * Extracts dialogue (「」) from fragments and checks for verbatim copies.
 */
export class QuoteOriginalityRule implements ComplianceRule {
  readonly name = 'quote_originality';
  private forbiddenQuotes: string[];

  constructor(fragments: Map<string, Fragment[]>) {
    this.forbiddenQuotes = this.extractQuotes(fragments);
  }

  check(text: string): Violation[] {
    const violations: Violation[] = [];

    if (!text || this.forbiddenQuotes.length === 0) {
      return violations;
    }

    for (const quote of this.forbiddenQuotes) {
      let index = text.indexOf(quote);

      while (index !== -1) {
        const contextStart = Math.max(0, index - 20);
        const contextEnd = Math.min(text.length, index + quote.length + 20);

        violations.push({
          type: 'quote_direct_copy',
          position: {
            start: index,
            end: index + quote.length,
          },
          context: text.slice(contextStart, contextEnd),
          rule: `Direct quote from source: "${quote.slice(0, 30)}${quote.length > 30 ? '...' : ''}"`,
          severity: 'warning',
        });

        index = text.indexOf(quote, index + 1);
      }
    }

    return violations;
  }

  private extractQuotes(fragments: Map<string, Fragment[]>): string[] {
    const quotes = new Set<string>();
    const quotePattern = /「([^」]{5,})」/g;

    for (const [, fragmentList] of fragments) {
      for (const fragment of fragmentList) {
        let match;
        while ((match = quotePattern.exec(fragment.text)) !== null) {
          quotes.add(match[1]);
        }
      }
    }

    return Array.from(quotes);
  }

  getExtractedQuotes(): string[] {
    return [...this.forbiddenQuotes];
  }
}
