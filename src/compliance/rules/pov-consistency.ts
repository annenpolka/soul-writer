import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';

function splitDialogueAndNarration(text: string): Array<{ text: string; offset: number; isDialogue: boolean }> {
  const segments: Array<{ text: string; offset: number; isDialogue: boolean }> = [];
  let pos = 0;

  while (pos < text.length) {
    const dialogueStart = text.indexOf('「', pos);
    if (dialogueStart === -1) {
      segments.push({ text: text.slice(pos), offset: pos, isDialogue: false });
      break;
    }

    if (dialogueStart > pos) {
      segments.push({ text: text.slice(pos, dialogueStart), offset: pos, isDialogue: false });
    }

    const dialogueEnd = text.indexOf('」', dialogueStart);
    if (dialogueEnd === -1) {
      segments.push({ text: text.slice(dialogueStart), offset: dialogueStart, isDialogue: true });
      break;
    }

    segments.push({ text: text.slice(dialogueStart, dialogueEnd + 1), offset: dialogueStart, isDialogue: true });
    pos = dialogueEnd + 1;
  }

  return segments;
}

function checkPovConsistency(narrativeRules: NarrativeRules | undefined, text: string): Violation[] {
  if (narrativeRules) {
    const { pov, isDefaultProtagonist } = narrativeRules;
    if (pov !== 'first-person' || !isDefaultProtagonist) {
      return [];
    }
  }

  const violations: Violation[] = [];
  const segments = splitDialogueAndNarration(text);

  // Check for wrong pronoun
  for (const segment of segments) {
    if (segment.isDialogue) continue;

    let index = segment.text.indexOf('私');
    while (index !== -1) {
      const nextChar = segment.text[index + 1] || '';
      const compoundStarts = ['立', '物', '服', '生', '的', '達', '用', '見', '情', '刑', '有', '設'];
      if (!compoundStarts.includes(nextChar)) {
        const absPos = segment.offset + index;
        const contextStart = Math.max(0, absPos - 15);
        const contextEnd = Math.min(text.length, absPos + 15);
        violations.push({
          type: 'forbidden_word',
          position: { start: absPos, end: absPos + 1 },
          context: text.slice(contextStart, contextEnd),
          rule: '一人称は「わたし」を使用（「私」は禁止）',
          severity: 'error',
        });
      }
      index = segment.text.indexOf('私', index + 1);
    }
  }

  return violations;
}

export function createPovConsistencyRule(narrativeRules?: NarrativeRules): ComplianceRule {
  return {
    name: 'pov_consistency',
    check: (text) => checkPovConsistency(narrativeRules, text),
  };
}

/**
 * PovConsistencyRule — adapter over createPovConsistencyRule() for backwards compatibility
 */
export class PovConsistencyRule implements ComplianceRule {
  readonly name = 'pov_consistency';
  private inner: ComplianceRule;

  constructor(narrativeRules?: NarrativeRules) {
    this.inner = createPovConsistencyRule(narrativeRules);
  }

  check(text: string): Violation[] {
    return this.inner.check(text);
  }
}
