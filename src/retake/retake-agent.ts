import type { RetakeDeps, Retaker, Defect } from '../agents/types.js';
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
    retake: async (originalText: string, feedback: string, defects?: Defect[]): Promise<RetakeResult> => {
      const tokensBefore = llmClient.getTotalTokens();

      const defectCategories = defects
        ? [...new Set(defects.map(d => d.category))]
        : undefined;

      const systemPrompt = buildRetakeSystemPrompt({
        soulText,
        narrativeRules,
        themeContext,
        defectCategories,
        detectorReasoning: deps.detectorReasoning,
      });

      const userPrompt = buildRetakeUserPrompt({
        originalText,
        feedback,
        plotChapter: deps.plotChapter,
      });

      const retakenText = await llmClient.complete(systemPrompt, userPrompt, {
        temperature: 1.0,
      });

      return {
        retakenText,
        tokensUsed: llmClient.getTotalTokens() - tokensBefore,
      };
    },
  };
}
