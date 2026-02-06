import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';

function createViolation(match: RegExpMatchArray, text: string, pattern: string): Violation {
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

function checkMarkdownContamination(text: string): Violation[] {
  const violations: Violation[] = [];

  if (!text) return violations;

  for (const match of text.matchAll(/\*\*[^*]+\*\*/g)) {
    violations.push(createViolation(match, text, 'bold (**...**)'));
  }

  for (const match of text.matchAll(/(?<!\*)\*(?!\*)[^*]+\*(?!\*)/g)) {
    violations.push(createViolation(match, text, 'italic (*...*)'));
  }

  for (const match of text.matchAll(/`[^`]+`/g)) {
    violations.push(createViolation(match, text, 'inline code (`...`)'));
  }

  for (const match of text.matchAll(/^```\s*\w*$/gm)) {
    violations.push(createViolation(match, text, 'code block (```)'));
  }

  for (const match of text.matchAll(/^#{1,6}\s/gm)) {
    violations.push(createViolation(match, text, 'heading (#)'));
  }

  return violations;
}

export function createMarkdownContaminationRule(): ComplianceRule {
  return {
    name: 'markdown_contamination',
    check: checkMarkdownContamination,
  };
}

/**
 * MarkdownContaminationRule — adapter over createMarkdownContaminationRule() for backwards compatibility
 */
export class MarkdownContaminationRule implements ComplianceRule {
  readonly name = 'markdown_contamination';
  private inner: ComplianceRule;

  constructor() {
    this.inner = createMarkdownContaminationRule();
  }

  check(text: string): Violation[] {
    return this.inner.check(text);
  }
}
