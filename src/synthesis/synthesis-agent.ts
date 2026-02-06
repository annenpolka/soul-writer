import type { GenerationResult, SynthesisDeps, Synthesizer } from '../agents/types.js';
import type { MatchResult } from '../tournament/arena.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { collectLoserExcerpts, buildSynthesisSystemPrompt, buildSynthesisUserPrompt } from '../agents/context/synthesis-context.js';

export interface SynthesisResult {
  synthesizedText: string;
  tokensUsed: number;
}

/**
 * Create a functional SynthesisAgent from dependencies
 */
export function createSynthesisAgent(deps: SynthesisDeps): Synthesizer {
  const { llmClient, soulText, themeContext } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();

  return {
    synthesize: async (
      championText: string,
      championId: string,
      allGenerations: GenerationResult[],
      rounds: MatchResult[],
    ): Promise<SynthesisResult> => {
      const loserExcerpts = collectLoserExcerpts(championId, allGenerations, rounds);

      if (loserExcerpts.length === 0) {
        return { synthesizedText: championText, tokensUsed: 0 };
      }

      const tokensBefore = llmClient.getTotalTokens();
      const systemPrompt = buildSynthesisSystemPrompt({ soulText, narrativeRules, themeContext });
      const userPrompt = buildSynthesisUserPrompt(championText, loserExcerpts);

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

