import type { SynthesisAnalyzerDeps, SynthesisExecutorDeps, SynthesizerV2, SynthesisAnalyzerInput, SynthesisV2Result } from '../agents/types.js';
import { createSynthesisAnalyzer } from './synthesis-analyzer.js';
import { createSynthesisExecutor } from './synthesis-executor.js';

/**
 * Create a functional SynthesisV2 orchestrator from dependencies.
 * Executes a 2-pass synthesis: analyze (structured plan) then execute (text generation).
 */
export function createSynthesisV2(deps: SynthesisAnalyzerDeps & SynthesisExecutorDeps): SynthesizerV2 {
  const analyzer = createSynthesisAnalyzer(deps);
  const executor = createSynthesisExecutor(deps);

  return {
    synthesize: async (input: SynthesisAnalyzerInput): Promise<SynthesisV2Result> => {
      // Early return when no losers
      if (input.allGenerations.length <= 1) {
        return {
          synthesizedText: input.championText,
          plan: null,
          totalTokensUsed: 0,
        };
      }

      // Pass 1: Analyze
      const analyzerResult = await analyzer.analyze(input);

      // Pass 2: Execute
      const executorResult = await executor.execute(input.championText, analyzerResult.plan);

      return {
        synthesizedText: executorResult.synthesizedText,
        plan: analyzerResult.plan,
        totalTokensUsed: analyzerResult.tokensUsed + executorResult.tokensUsed,
      };
    },
  };
}
