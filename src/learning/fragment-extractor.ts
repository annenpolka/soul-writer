import type { VerdictLevel } from '../agents/types.js';
import { z } from 'zod';
import type { LLMClient } from '../llm/types.js';
import { verdictToString } from '../evaluation/verdict-utils.js';
import { buildPrompt } from '../template/composer.js';

export interface ExtractedFragment {
  text: string;
  category: string;
  score: number;
  reason: string;
}

export interface ExtractionContext {
  verdictLevel: VerdictLevel;
}

export interface ExtractionResult {
  fragments: ExtractedFragment[];
  tokensUsed: number;
}

export interface FragmentExtractorFn {
  extract(text: string, context: ExtractionContext): Promise<ExtractionResult>;
  filterHighQuality(fragments: ExtractedFragment[], minScore: number): ExtractedFragment[];
}

const FragmentResponseSchema = z.object({
  fragments: z.array(z.object({
    text: z.string(),
    category: z.string(),
    score: z.number(),
    reason: z.string(),
  })),
});

// =====================
// Parser
// =====================

function parseFragmentResponse(raw: unknown): ExtractedFragment[] {
  const parsed = FragmentResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.fragments;
}

// =====================
// Factory
// =====================

export function createFragmentExtractor(llmClient: LLMClient): FragmentExtractorFn {
  return {
    async extract(text: string, context: ExtractionContext): Promise<ExtractionResult> {
      const templateContext = {
        text,
        verdictLevel: context.verdictLevel,
        verdictLabel: verdictToString(context.verdictLevel),
      };

      const { system: systemPrompt, user: userPrompt } = buildPrompt('fragment-extractor', templateContext);
      const tokensBefore = llmClient.getTotalTokens();

      const response = await llmClient.completeStructured(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        FragmentResponseSchema,
        { temperature: 1.0 },
      );

      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;
      const fragments = parseFragmentResponse(response.data);

      return { fragments, tokensUsed };
    },

    filterHighQuality(fragments: ExtractedFragment[], minScore: number): ExtractedFragment[] {
      return fragments.filter((f) => f.score >= minScore);
    },
  };
}
