import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';

/**
 * Rule that checks for POV consistency:
 * - Must use 「わたし」 not 「私」 (only for first-person default protagonist)
 * - No third-person narrative intrusion (only for first-person default protagonist)
 */
export class PovConsistencyRule implements ComplianceRule {
  readonly name = 'pov_consistency';
  private narrativeRules?: NarrativeRules;

  constructor(narrativeRules?: NarrativeRules) {
    this.narrativeRules = narrativeRules;
  }

  check(text: string): Violation[] {
    // Skip POV checks for non-default narratives
    if (this.narrativeRules) {
      const { pov, isDefaultProtagonist } = this.narrativeRules;
      if (pov !== 'first-person' || !isDefaultProtagonist) {
        return [];
      }
    }

    const violations: Violation[] = [];

    // Check for 「私」 used as first-person pronoun (not inside quotes from other characters)
    this.checkWrongPronoun(text, violations);

    // Check for third-person narrative patterns
    this.checkThirdPerson(text, violations);

    return violations;
  }

  private checkWrongPronoun(text: string, violations: Violation[]): void {
    // Split text into dialogue and narration
    const segments = this.splitDialogueAndNarration(text);

    for (const segment of segments) {
      if (segment.isDialogue) continue; // Skip dialogue - characters may use different pronouns

      let index = segment.text.indexOf('私');
      while (index !== -1) {
        // Check it's not part of a compound word like 私立, 私物, 私服, 私生活
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
  }

  private checkThirdPerson(text: string, violations: Violation[]): void {
    // Detect third-person narrative patterns about the protagonist
    const thirdPersonPatterns = [
      /透心は(?:思った|感じた|考えた|言った)/g,
      /彼女(?:の|は|が|を|に)(?!.*[「」])/g, // 「彼女」 in narration (not dialogue)
    ];

    const segments = this.splitDialogueAndNarration(text);
    for (const segment of segments) {
      if (segment.isDialogue) continue;

      for (const pattern of thirdPersonPatterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(segment.text)) !== null) {
          const absPos = segment.offset + match.index;
          const contextStart = Math.max(0, absPos - 15);
          const contextEnd = Math.min(text.length, absPos + match[0].length + 15);
          violations.push({
            type: 'theme_violation',
            position: { start: absPos, end: absPos + match[0].length },
            context: text.slice(contextStart, contextEnd),
            rule: '三人称描写の混入（一人称視点を維持すること）',
            severity: 'warning',
          });
        }
      }
    }
  }

  private splitDialogueAndNarration(text: string): Array<{ text: string; offset: number; isDialogue: boolean }> {
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
}
