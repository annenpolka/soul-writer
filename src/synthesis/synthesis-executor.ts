import type { SynthesisExecutorDeps, SynthesisExecutorFn, ImprovementPlan } from '../agents/types.js';
import type { LLMMessage } from '../llm/types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildSynthesisExecutorContext } from '../agents/context/synthesis-executor-context.js';
import { buildPrompt } from '../template/composer.js';

/**
 * Create a functional SynthesisExecutor from dependencies.
 * When analyzerReasoning is provided, uses messages-based multi-turn conversation
 * so the executor can reference the analyzer's reasoning process.
 */
export function createSynthesisExecutor(deps: SynthesisExecutorDeps): SynthesisExecutorFn {
  const { llmClient, soulText, themeContext } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();

  return {
    execute: async (championText: string, plan: ImprovementPlan, analyzerReasoning?: string | null): Promise<{ synthesizedText: string; tokensUsed: number }> => {
      const context = buildSynthesisExecutorContext({
        soulText,
        championText,
        plan,
        narrativeRules,
        themeContext,
      });

      const { system: systemPrompt, user: userPrompt } = buildPrompt('synthesis-executor', context);

      const tokensBefore = llmClient.getTotalTokens();
      let result: string;

      if (analyzerReasoning) {
        // Multi-turn: include analyzer's plan + reasoning as prior context
        const messages: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '改善計画の分析を行いました。' },
          {
            role: 'assistant',
            content: JSON.stringify(plan),
            reasoning: analyzerReasoning,
          },
          { role: 'user', content: userPrompt },
        ];
        result = await llmClient.complete(messages, { temperature: 1.0 });
      } else {
        // Legacy: string-based call
        result = await llmClient.complete(systemPrompt, userPrompt, { temperature: 1.0 });
      }

      return {
        synthesizedText: result,
        tokensUsed: llmClient.getTotalTokens() - tokensBefore,
      };
    },
  };
}
