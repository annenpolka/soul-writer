import type { ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient } from '../llm/tooling.js';
import type { SynthesisAnalyzerDeps, SynthesisV2Result } from '../agents/types.js';
import type { CollaborationResult } from '../collaboration/types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildCollaborationSynthesisContext } from '../agents/context/collaboration-synthesis-context.js';
import { parseSynthesisAnalyzerResponse } from '../agents/parsers/synthesis-analyzer-parser.js';
import { createSynthesisExecutor } from './synthesis-executor.js';
import { buildPrompt } from '../template/composer.js';

/**
 * Collaboration-specific synthesis interface
 */
export interface CollaborationSynthesizerFn {
  synthesize: (finalText: string, collaborationResult: CollaborationResult) => Promise<SynthesisV2Result>;
}

const SUBMIT_IMPROVEMENT_PLAN_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_improvement_plan',
    description: 'コラボレーション結果に基づく構造化された改善計画を提出する',
    parameters: {
      type: 'object',
      properties: {
        championAssessment: { type: 'string', description: '最終テキストの総合評価' },
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
 * Create a collaboration-specific synthesis agent.
 * Analysis pass uses collaboration context (feedback, drafts, consensus).
 * Execution pass reuses SynthesisExecutor.
 */
export function createCollaborationSynthesis(deps: SynthesisAnalyzerDeps): CollaborationSynthesizerFn {
  const { llmClient, soulText, themeContext } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();
  const executor = createSynthesisExecutor({ llmClient, soulText, narrativeRules, themeContext });

  return {
    synthesize: async (finalText: string, collaborationResult: CollaborationResult): Promise<SynthesisV2Result> => {
      // Pass 1: Collaboration-specific analysis
      const context = buildCollaborationSynthesisContext({
        soulText,
        collaborationResult,
        narrativeRules,
        themeContext,
      });

      const { system: systemPrompt, user: userPrompt } = buildPrompt('collaboration-synthesis', context);

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
      const analyzerTokens = llmClient.getTotalTokens() - tokensBefore;

      // Pass 2: Reuse SynthesisExecutor
      const executorResult = await executor.execute(finalText, plan);

      return {
        synthesizedText: executorResult.synthesizedText,
        plan,
        totalTokensUsed: analyzerTokens + executorResult.tokensUsed,
      };
    },
  };
}
