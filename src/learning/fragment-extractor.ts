import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
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

// =====================
// Tool Definition
// =====================

const SUBMIT_FRAGMENTS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_fragments',
    description: 'ソウルテキスト断片の抽出結果を提出する',
    parameters: {
      type: 'object',
      properties: {
        fragments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              category: { type: 'string' },
              score: { type: 'number' },
              reason: { type: 'string' },
            },
            required: ['text', 'category', 'score', 'reason'],
            additionalProperties: false,
          },
        },
      },
      required: ['fragments'],
      additionalProperties: false,
    },
    strict: true,
  },
};

// =====================
// Parser
// =====================

function parseFragmentResponse(response: ToolCallResponse): ExtractedFragment[] {
  try {
    const result = parseToolArguments<{ fragments: ExtractedFragment[] }>(
      response, 'submit_fragments',
    );
    return result.fragments || [];
  } catch {
    return [];
  }
}

// =====================
// Factory
// =====================

export function createFragmentExtractor(llmClient: LLMClient): FragmentExtractorFn {
  return {
    async extract(text: string, context: ExtractionContext): Promise<ExtractionResult> {
      const templateContext = {
        text,
        complianceScore: String(context.complianceScore),
        readerScore: String(context.readerScore),
      };

      const { system: systemPrompt, user: userPrompt } = buildPrompt('fragment-extractor', templateContext);
      const tokensBefore = llmClient.getTotalTokens();

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_FRAGMENTS_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_fragments' } },
        },
      );

      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;
      const fragments = parseFragmentResponse(response);

      return { fragments, tokensUsed };
    },

    filterHighQuality(fragments: ExtractedFragment[], minScore: number): ExtractedFragment[] {
      return fragments.filter((f) => f.score >= minScore);
    },
  };
}
