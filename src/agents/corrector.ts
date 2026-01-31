import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { CorrectionResult, Violation } from './types.js';
import { buildPrompt } from '../template/composer.js';

/**
 * CorrectorAgent fixes compliance violations in text using LLM
 */
export class CorrectorAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  /**
   * Correct text by fixing specified violations
   */
  async correct(text: string, violations: Violation[]): Promise<CorrectionResult> {
    const violationList = violations
      .map(
        (v, i) =>
          `${i + 1}. [${v.type}] "${v.context}" - ${v.rule} (severity: ${v.severity})`
      )
      .join('\n');

    const constitution = this.soulText.constitution;

    const context = {
      forbiddenWords: constitution.vocabulary.forbidden_words,
      forbiddenSimiles: constitution.rhetoric.forbidden_similes,
      specialMark: constitution.vocabulary.special_marks.mark,
      specialMarkForms: constitution.vocabulary.special_marks.forms,
      text,
      violationList,
    };

    const { system: systemPrompt, user: userPrompt } = buildPrompt('corrector', context);
    const correctedText = await this.llmClient.complete(systemPrompt, userPrompt);
    const tokensUsed = this.llmClient.getTotalTokens();

    return {
      correctedText,
      tokensUsed,
    };
  }
}
