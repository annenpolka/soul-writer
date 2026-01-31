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

/**
 * Extracts high-quality fragments from generated text for potential soul expansion
 */
export class FragmentExtractor {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Extract notable fragments from text
   */
  async extract(text: string, context: ExtractionContext): Promise<ExtractionResult> {
    const templateContext = {
      text,
      complianceScore: String(context.complianceScore),
      readerScore: String(context.readerScore),
    };

    const { system: systemPrompt, user: userPrompt } = buildPrompt('fragment-extractor', templateContext);
    const response = await this.llmClient.complete(systemPrompt, userPrompt);
    const tokensUsed = this.llmClient.getTotalTokens();

    try {
      const parsed = JSON.parse(response) as { fragments: ExtractedFragment[] };
      return {
        fragments: parsed.fragments || [],
        tokensUsed,
      };
    } catch {
      return {
        fragments: [],
        tokensUsed,
      };
    }
  }

  /**
   * Filter fragments by minimum quality score
   */
  filterHighQuality(fragments: ExtractedFragment[], minScore: number): ExtractedFragment[] {
    return fragments.filter((f) => f.score >= minScore);
  }
}
