import type { SynthesisExecutorDeps, SynthesisExecutorFn, ImprovementPlan } from '../agents/types.js';
import type { LLMMessage } from '../llm/types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildSynthesisExecutorContext } from '../agents/context/synthesis-executor-context.js';
import { buildPrompt } from '../template/composer.js';

/**
 * Strip leaked JSON blocks from the executor's LLM response.
 * The multi-turn conversation includes the ImprovementPlan as an assistant JSON message.
 * LLMs occasionally echo this JSON back at the start of their response.
 * This function detects and removes such leading JSON blocks.
 */
export function stripLeakedJson(text: string): string {
  const trimmed = text.trimStart();

  // Detect leading JSON object (starts with '{')
  if (!trimmed.startsWith('{')) return text;

  // Find the matching closing brace
  let depth = 0;
  let endIndex = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++;
    else if (trimmed[i] === '}') {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) return text;

  // Verify it's actually JSON (not narrative text that happens to start with '{')
  const candidate = trimmed.slice(0, endIndex + 1);
  try {
    const parsed = JSON.parse(candidate);
    // Only strip if it looks like an ImprovementPlan (has characteristic keys)
    if (parsed && typeof parsed === 'object' &&
        ('championAssessment' in parsed || 'actions' in parsed || 'preserveElements' in parsed)) {
      const remaining = trimmed.slice(endIndex + 1).trimStart();
      if (remaining.length > 0) {
        return remaining;
      }
    }
  } catch {
    // Not valid JSON, leave text as-is
  }

  return text;
}

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
        synthesizedText: stripLeakedJson(result),
        tokensUsed: llmClient.getTotalTokens() - tokensBefore,
      };
    },
  };
}
