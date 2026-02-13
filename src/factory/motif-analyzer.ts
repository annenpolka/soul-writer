import { z } from 'zod';
import type { LLMClient } from '../llm/types.js';
import type { Work } from '../storage/work-repository.js';
import { buildPrompt } from '../template/composer.js';

const MotifAnalysisResponseSchema = z.object({
  frequent_motifs: z.array(z.string()),
});

export interface MotifAnalysisResult {
  frequentMotifs: string[];
  tokensUsed: number;
}

// --- FP interface ---

export interface MotifAnalyzerFn {
  analyze: (works: Work[]) => Promise<MotifAnalysisResult>;
}

// --- Internal helpers ---

// --- Factory function ---

export function createMotifAnalyzer(llmClient: LLMClient): MotifAnalyzerFn {
  return {
    analyze: async (works: Work[]): Promise<MotifAnalysisResult> => {
      if (works.length === 0) {
        return { frequentMotifs: [], tokensUsed: 0 };
      }

      const tokensBefore = llmClient.getTotalTokens();

      const context = {
        works: works.map(w => ({
          title: w.title,
          excerpt: w.content.slice(0, 2000),
        })),
        workCount: works.length,
      };

      const { system: systemPrompt, user: userPrompt } = buildPrompt('motif-analyzer', context);

      let motifs: string[];
      try {
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          MotifAnalysisResponseSchema,
          { temperature: 1.0 },
        );

        motifs = response.data.frequent_motifs;
      } catch (e) {
        console.warn('[motif-analyzer] completeStructured failed, returning empty motifs:', e instanceof Error ? e.message : e);
        motifs = [];
      }

      const tokensAfter = llmClient.getTotalTokens();

      return {
        frequentMotifs: motifs,
        tokensUsed: tokensAfter - tokensBefore,
      };
    },
  };
}

