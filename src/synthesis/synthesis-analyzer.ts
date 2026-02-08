import type { ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient } from '../llm/tooling.js';
import type { SynthesisAnalyzerDeps, SynthesisAnalyzer, SynthesisAnalyzerInput, ImprovementPlan } from '../agents/types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildSynthesisAnalyzerContext } from '../agents/context/synthesis-analyzer-context.js';
import { parseSynthesisAnalyzerResponse, createFallbackPlan } from '../agents/parsers/synthesis-analyzer-parser.js';
import { buildPrompt } from '../template/composer.js';

const SUBMIT_IMPROVEMENT_PLAN_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_improvement_plan',
    description: '構造化された改善計画を提出する',
    parameters: {
      type: 'object',
      properties: {
        championAssessment: { type: 'string', description: '勝者テキストの総合評価' },
        preserveElements: {
          type: 'array',
          items: { type: 'string' },
          description: '維持すべき要素',
        },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section: { type: 'string' },
              type: {
                type: 'string',
                enum: ['expression_upgrade', 'pacing_adjustment', 'scene_reorder', 'motif_fix', 'voice_refinement', 'imagery_injection', 'tension_enhancement'],
              },
              description: { type: 'string' },
              source: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['section', 'type', 'description', 'source', 'priority'],
            additionalProperties: false,
          },
        },
        structuralChanges: {
          type: 'array',
          items: { type: 'string' },
          description: '構造的変更の提案（任意）',
        },
        expressionSources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              writerId: { type: 'string' },
              expressions: { type: 'array', items: { type: 'string' } },
              context: { type: 'string' },
            },
            required: ['writerId', 'expressions', 'context'],
            additionalProperties: false,
          },
        },
      },
      required: ['championAssessment', 'preserveElements', 'actions', 'expressionSources'],
      additionalProperties: false,
    },
    strict: true,
  },
};

/**
 * Create a functional SynthesisAnalyzer from dependencies
 */
export function createSynthesisAnalyzer(deps: SynthesisAnalyzerDeps): SynthesisAnalyzer {
  const { llmClient, soulText, themeContext, macGuffinContext } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();

  return {
    analyze: async (input: SynthesisAnalyzerInput): Promise<{ plan: ImprovementPlan; tokensUsed: number }> => {
      // Early return when no losers
      if (input.allGenerations.length <= 1) {
        return { plan: createFallbackPlan(), tokensUsed: 0 };
      }

      const context = buildSynthesisAnalyzerContext({
        soulText,
        input,
        narrativeRules,
        themeContext,
        macGuffinContext,
      });

      const { system: systemPrompt, user: userPrompt } = buildPrompt('synthesis-analyzer', context);

      assertToolCallingClient(llmClient);
      const tokensBefore = llmClient.getTotalTokens();
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_IMPROVEMENT_PLAN_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_improvement_plan' } },
          temperature: 0.4,
        },
      );

      const plan = parseSynthesisAnalyzerResponse(response);
      return {
        plan,
        tokensUsed: llmClient.getTotalTokens() - tokensBefore,
      };
    },
  };
}
