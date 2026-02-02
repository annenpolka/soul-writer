import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { Work } from '../storage/work-repository.js';
import { buildPrompt } from '../template/composer.js';

const SUBMIT_MOTIF_ANALYSIS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_motif_analysis',
    description: '頻出モチーフ分析の結果を提出する',
    parameters: {
      type: 'object',
      properties: {
        frequent_motifs: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['frequent_motifs'],
      additionalProperties: false,
    },
    strict: true,
  },
};

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

    assertToolCallingClient(this.llmClient);
    const response = await this.llmClient.completeWithTools(
      systemPrompt,
      userPrompt,
      [SUBMIT_MOTIF_ANALYSIS_TOOL],
      {
        toolChoice: { type: 'function', function: { name: 'submit_motif_analysis' } },
        temperature: 0.3,
      },
    );

    const motifs = this.parseToolResponse(response);
    const tokensAfter = this.llmClient.getTotalTokens();

    return {
      frequentMotifs: motifs,
      tokensUsed: tokensAfter - tokensBefore,
    };
  }

  private parseToolResponse(response: ToolCallResponse): string[] {
    let parsed: unknown;
    try {
      parsed = parseToolArguments<unknown>(response, 'submit_motif_analysis');
    } catch {
      return [];
    }

    if (!parsed || typeof parsed !== 'object') return [];
    const raw = parsed as { frequentMotifs?: unknown; frequent_motifs?: unknown };
    const motifs = raw.frequent_motifs ?? raw.frequentMotifs;
    return Array.isArray(motifs) ? motifs.filter((m) => typeof m === 'string') : [];
  }
}
