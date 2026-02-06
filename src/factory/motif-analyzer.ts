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

// --- FP interface ---

export interface MotifAnalyzerFn {
  analyze: (works: Work[]) => Promise<MotifAnalysisResult>;
}

// --- Internal helpers ---

function parseMotifToolResponse(response: ToolCallResponse): string[] {
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

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_MOTIF_ANALYSIS_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_motif_analysis' } },
          temperature: 0.3,
        },
      );

      const motifs = parseMotifToolResponse(response);
      const tokensAfter = llmClient.getTotalTokens();

      return {
        frequentMotifs: motifs,
        tokensUsed: tokensAfter - tokensBefore,
      };
    },
  };
}

