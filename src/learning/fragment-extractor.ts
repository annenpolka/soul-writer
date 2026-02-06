import type { LLMClient } from '../llm/types.js';
import { buildPrompt } from '../template/composer.js';

export interface ExtractedFragment {
  text: string;
  category: string;
  score: number;
  reason: string;
}

export interface ExtractionContext {
  complianceScore: number;
  readerScore: number;
}

export interface ExtractionResult {
  fragments: ExtractedFragment[];
  tokensUsed: number;
}

export interface FragmentExtractorFn {
  extract(text: string, context: ExtractionContext): Promise<ExtractionResult>;
  filterHighQuality(fragments: ExtractedFragment[], minScore: number): ExtractedFragment[];
}

export function createFragmentExtractor(llmClient: LLMClient): FragmentExtractorFn {
  return {
    async extract(text: string, context: ExtractionContext): Promise<ExtractionResult> {
      const templateContext = {
        text,
        complianceScore: String(context.complianceScore),
        readerScore: String(context.readerScore),
      };

      const { system: systemPrompt, user: userPrompt } = buildPrompt('fragment-extractor', templateContext);
      const response = await llmClient.complete(systemPrompt, userPrompt);
      const tokensUsed = llmClient.getTotalTokens();

      try {
        const parsed = JSON.parse(response) as { fragments: ExtractedFragment[] };
        return {
          fragments: parsed.fragments || [],
          tokensUsed,
        };
      } catch (e) {
        console.warn('[fragment-extractor] JSON parse failed, returning empty fragments:', e instanceof Error ? e.message : e);
        return {
          fragments: [],
          tokensUsed,
        };
      }
    },

    filterHighQuality(fragments: ExtractedFragment[], minScore: number): ExtractedFragment[] {
      return fragments.filter((f) => f.score >= minScore);
    },
  };
}

