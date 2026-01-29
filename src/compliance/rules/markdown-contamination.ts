import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';

/**
 * Rule that detects markdown syntax contamination in prose text
 */
export class MarkdownContaminationRule implements ComplianceRule {
  readonly name = 'markdown_contamination';

  check(text: string): Violation[] {
    const violations: Violation[] = [];

    if (!text) return violations;

    // Bold: **text**
    for (const match of text.matchAll(/\*\*[^*]+\*\*/g)) {
      violations.push(this.createViolation(match, text, 'bold (**...**)'));
    }

    // Italic: *text* (but not ** which is bold)
    for (const match of text.matchAll(/(?<!\*)\*(?!\*)[^*]+\*(?!\*)/g)) {
      violations.push(this.createViolation(match, text, 'italic (*...*)'));
    }

    // Inline code: `text`
    for (const match of text.matchAll(/`[^`]+`/g)) {
      violations.push(this.createViolation(match, text, 'inline code (`...`)'));
    }

    // Code block: ``` on its own line
    for (const match of text.matchAll(/^```\s*\w*$/gm)) {
      violations.push(this.createViolation(match, text, 'code block (```)'));
    }

    // Headings: # at start of line
    for (const match of text.matchAll(/^#{1,6}\s/gm)) {
      violations.push(this.createViolation(match, text, 'heading (#)'));
    }

    return violations;
  }

  private createViolation(match: RegExpMatchArray, text: string, pattern: string): Violation {
    const index = match.index ?? 0;
    const contextStart = Math.max(0, index - 20);
    const contextEnd = Math.min(text.length, index + match[0].length + 20);

    return {
      type: 'markdown_contamination',
      position: {
        start: index,
        end: index + match[0].length,
      },
      context: text.slice(contextStart, contextEnd),
      rule: `Markdown syntax detected: ${pattern}`,
      severity: 'error',
    };
  }
}
