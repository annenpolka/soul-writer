import type { SoulText } from '../soul/manager.js';
import type { CorrectionResult, Violation, ThemeContext, CorrectorDeps, Corrector } from './types.js';
import { buildPrompt } from '../template/composer.js';

/**
 * Build corrector prompt context (pure function)
 */
export function buildCorrectorContext(
  soulText: SoulText,
  text: string,
  violations: Violation[],
  themeContext?: ThemeContext,
): Record<string, unknown> {
  const violationList = violations
    .map(
      (v, i) =>
        `${i + 1}. [${v.type}] "${v.context}" - ${v.rule} (severity: ${v.severity})`
    )
    .join('\n');

  const u = soulText.constitution.universal;

  return {
    forbiddenWords: u.vocabulary.forbidden_words,
    forbiddenSimiles: u.rhetoric.forbidden_similes,
    specialMark: u.vocabulary.special_marks.mark,
    specialMarkForms: u.vocabulary.special_marks.forms,
    themeContext,
    text,
    violationList,
  };
}

/**
 * Create a functional Corrector from dependencies
 */
export function createCorrector(deps: CorrectorDeps): Corrector {
  const { llmClient, soulText, themeContext } = deps;

  return {
    correct: async (text: string, violations: Violation[]): Promise<CorrectionResult> => {
      const context = buildCorrectorContext(soulText, text, violations, themeContext);
      const { system: systemPrompt, user: userPrompt } = buildPrompt('corrector', context);
      const correctedText = await llmClient.complete(systemPrompt, userPrompt);
      const tokensUsed = llmClient.getTotalTokens();

      return { correctedText, tokensUsed };
    },
  };
}

