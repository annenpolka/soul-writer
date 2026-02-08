import type { SynthesisExecutorDeps, SynthesisExecutorFn, ImprovementPlan } from '../agents/types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildSynthesisExecutorContext } from '../agents/context/synthesis-executor-context.js';
import { buildPrompt } from '../template/composer.js';

/**
 * Create a functional SynthesisExecutor from dependencies
 */
export function createSynthesisExecutor(deps: SynthesisExecutorDeps): SynthesisExecutorFn {
  const { llmClient, soulText, themeContext } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();

  return {
    execute: async (championText: string, plan: ImprovementPlan): Promise<{ synthesizedText: string; tokensUsed: number }> => {
      const context = buildSynthesisExecutorContext({
        soulText,
        championText,
        plan,
        narrativeRules,
        themeContext,
      });

      const { system: systemPrompt, user: userPrompt } = buildPrompt('synthesis-executor', context);

      const tokensBefore = llmClient.getTotalTokens();
      const result = await llmClient.complete(systemPrompt, userPrompt, {
        temperature: 0.6,
      });

      return {
        synthesizedText: result,
        tokensUsed: llmClient.getTotalTokens() - tokensBefore,
      };
    },
  };
}
