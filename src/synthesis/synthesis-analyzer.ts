import type { SynthesisAnalyzerDeps, SynthesisAnalyzer, SynthesisAnalyzerInput, ImprovementPlan } from '../agents/types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildSynthesisAnalyzerContext } from '../agents/context/synthesis-analyzer-context.js';
import { parseSynthesisAnalyzerResponse, createFallbackPlan } from '../agents/parsers/synthesis-analyzer-parser.js';
import { buildPrompt } from '../template/composer.js';
import { ImprovementPlanSchema } from '../schemas/improvement-plan.js';

/**
 * Create a functional SynthesisAnalyzer from dependencies
 */
export function createSynthesisAnalyzer(deps: SynthesisAnalyzerDeps): SynthesisAnalyzer {
  const { llmClient, soulText, themeContext, macGuffinContext } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();

  return {
    analyze: async (input: SynthesisAnalyzerInput): Promise<{ plan: ImprovementPlan; tokensUsed: number; reasoning: string | null }> => {
      // Early return when no losers
      if (input.allGenerations.length <= 1) {
        return { plan: createFallbackPlan(), tokensUsed: 0, reasoning: null };
      }

      const context = buildSynthesisAnalyzerContext({
        soulText,
        input,
        narrativeRules,
        themeContext,
        macGuffinContext,
        judgeReasoning: input.judgeReasoning,
      });

      const { system: systemPrompt, user: userPrompt } = buildPrompt('synthesis-analyzer', context);

      try {
        const tokensBefore = llmClient.getTotalTokens();
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          ImprovementPlanSchema,
          { temperature: 1.0 },
        );

        const plan = parseSynthesisAnalyzerResponse(response);
        return {
          plan,
          tokensUsed: llmClient.getTotalTokens() - tokensBefore,
          reasoning: response.reasoning ?? null,
        };
      } catch (e) {
        console.warn('[synthesis-analyzer] completeStructured failed, using fallback:', e instanceof Error ? e.message : e);
        return { plan: createFallbackPlan(), tokensUsed: 0, reasoning: null };
      }
    },
  };
}
