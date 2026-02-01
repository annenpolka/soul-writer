import type { LLMClient } from '../llm/types.js';
import type { Work } from '../storage/work-repository.js';
import { buildPrompt } from '../template/composer.js';

export interface MotifAnalysisResult {
  frequentMotifs: string[];
  tokensUsed: number;
}

/**
 * Analyzes recent works to extract frequently repeated motifs/patterns.
 * Results are used to guide theme generation away from repetitive patterns.
 */
export class MotifAnalyzerAgent {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  async analyze(works: Work[]): Promise<MotifAnalysisResult> {
    if (works.length === 0) {
      return { frequentMotifs: [], tokensUsed: 0 };
    }

    const tokensBefore = this.llmClient.getTotalTokens();

    const context = {
      works: works.map(w => ({
        title: w.title,
        excerpt: w.content.slice(0, 2000),
      })),
      workCount: works.length,
    };

    const { system: systemPrompt, user: userPrompt } = buildPrompt('motif-analyzer', context);

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.3,
    });

    const motifs = this.parseResponse(response);
    const tokensAfter = this.llmClient.getTotalTokens();

    return {
      frequentMotifs: motifs,
      tokensUsed: tokensAfter - tokensBefore,
    };
  }

  private parseResponse(response: string): string[] {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as { frequent_motifs?: string[] };
      return parsed.frequent_motifs ?? [];
    } catch {
      return [];
    }
  }
}
