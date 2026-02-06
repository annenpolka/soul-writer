import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';

function splitSentences(text: string): Array<{ text: string; offset: number }> {
  const results: Array<{ text: string; offset: number }> = [];
  const pattern = /[^。！？「」\n]+[。！？]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const trimmed = match[0].trim();
    if (trimmed.length > 0) {
      results.push({ text: trimmed, offset: match.index });
    }
  }
  return results;
}

function checkRhythm(maxSentenceLength: number, minShortSentenceRatio: number, text: string): Violation[] {
  const violations: Violation[] = [];

  const sentences = splitSentences(text);
  if (sentences.length === 0) return violations;

  for (const sentence of sentences) {
    if (sentence.text.length > maxSentenceLength) {
      violations.push({
        type: 'sentence_too_long',
        position: { start: sentence.offset, end: sentence.offset + sentence.text.length },
        context: sentence.text.slice(0, 60) + '...',
        rule: `文が${maxSentenceLength}字を超えています（${sentence.text.length}字）`,
        severity: 'warning',
      });
    }
  }

  const shortCount = sentences.filter(s => s.text.length <= 20).length;
  const ratio = shortCount / sentences.length;
  if (ratio < minShortSentenceRatio && sentences.length >= 5) {
    violations.push({
      type: 'sentence_too_long',
      position: { start: 0, end: Math.min(text.length, 100) },
      context: `短文比率: ${(ratio * 100).toFixed(0)}%（最低${(minShortSentenceRatio * 100).toFixed(0)}%必要）`,
      rule: '短文（20字以下）の比率が低すぎます。「短-短-長-短」リズムを意識してください',
      severity: 'warning',
    });
  }

  return violations;
}

export function createRhythmCheckRule(maxSentenceLength = 100, minShortSentenceRatio = 0.3): ComplianceRule {
  return {
    name: 'rhythm_check',
    check: (text) => checkRhythm(maxSentenceLength, minShortSentenceRatio, text),
  };
}

/**
 * RhythmCheckRule — adapter over createRhythmCheckRule() for backwards compatibility
 */
export class RhythmCheckRule implements ComplianceRule {
  readonly name = 'rhythm_check';
  private inner: ComplianceRule;

  constructor(maxSentenceLength = 100, minShortSentenceRatio = 0.3) {
    this.inner = createRhythmCheckRule(maxSentenceLength, minShortSentenceRatio);
  }

  check(text: string): Violation[] {
    return this.inner.check(text);
  }
}
