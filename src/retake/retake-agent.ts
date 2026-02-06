import type { RetakeDeps, Retaker } from '../agents/types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildRetakeSystemPrompt, buildRetakeUserPrompt } from '../agents/context/retake-context.js';

export interface RetakeResult {
  retakenText: string;
  tokensUsed: number;
}

/**
 * Create a functional RetakeAgent from dependencies
 */
export function createRetakeAgent(deps: RetakeDeps): Retaker {
  const { llmClient, soulText, themeContext } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();

  return {
    retake: async (originalText: string, feedback: string): Promise<RetakeResult> => {
      const tokensBefore = llmClient.getTotalTokens();
      const systemPrompt = buildRetakeSystemPrompt({ soulText, narrativeRules, themeContext });
      const userPrompt = buildRetakeUserPrompt(originalText, feedback);

      const retakenText = await llmClient.complete(systemPrompt, userPrompt, {
        temperature: 0.6,
      });

      return {
        retakenText,
        tokensUsed: llmClient.getTotalTokens() - tokensBefore,
      };
    },
  };
}

