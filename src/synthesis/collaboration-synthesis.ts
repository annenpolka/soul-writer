import type { SynthesisAnalyzerDeps, SynthesisV2Result } from '../agents/types.js';
import type { CollaborationResult } from '../collaboration/types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildCollaborationSynthesisContext } from '../agents/context/collaboration-synthesis-context.js';
import { parseSynthesisAnalyzerResponse } from '../agents/parsers/synthesis-analyzer-parser.js';
import { createSynthesisExecutor } from './synthesis-executor.js';
import { buildPrompt } from '../template/composer.js';
import { ImprovementPlanSchema } from '../schemas/improvement-plan.js';

/**
 * Collaboration-specific synthesis interface
 */
export interface CollaborationSynthesizerFn {
  synthesize: (finalText: string, collaborationResult: CollaborationResult) => Promise<SynthesisV2Result>;
}


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

      const tokensBefore = llmClient.getTotalTokens();
      const response = await llmClient.completeStructured!(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ImprovementPlanSchema,
        { temperature: 1.0 },
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
