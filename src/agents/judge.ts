import type { JudgeResult, JudgeDeps, Judge } from './types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildPrompt } from '../template/composer.js';
import { buildJudgeContext } from './context/judge-context.js';
import { parseJudgeResponse, createFallbackResult } from './parsers/judge-parser.js';
import { JudgeResponseSchema } from '../schemas/judge-response.js';

export type { JudgeResult };

/**
 * Create a functional Judge from dependencies
 */
export function createJudge(deps: JudgeDeps): Judge {
  const { llmClient, soulText } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();
  const themeContext = deps.themeContext;

  return {
    evaluate: async (textA: string, textB: string): Promise<JudgeResult> => {
      const context = buildJudgeContext({ soulText, narrativeRules, textA, textB, themeContext });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('judge', context);

      try {
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          JudgeResponseSchema,
          { temperature: 1.0 },
        );

        return parseJudgeResponse(response);
      } catch (e) {
        console.warn('[judge] completeStructured failed, using fallback:', e instanceof Error ? e.message : e);
        return createFallbackResult();
      }
    },
  };
}
