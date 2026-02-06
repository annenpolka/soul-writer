import type { ReaderJuryResult, ReaderJuryDeps, ReaderJury as ReaderJuryType } from './types.js';
import { createReaderEvaluator } from './reader-evaluator.js';
import { calculateAggregatedScore, generateSummary } from './context/reader-jury-context.js';

const PASSING_THRESHOLD = 0.85;

/**
 * Create a functional ReaderJury from dependencies
 */
export function createReaderJury(deps: ReaderJuryDeps): ReaderJuryType {
  const { llmClient, soulText, personas: depsPersonas } = deps;
  const personas = depsPersonas ?? soulText.readerPersonas.personas;

  return {
    evaluate: async (text: string, previousResult?: ReaderJuryResult): Promise<ReaderJuryResult> => {
      const evaluations = await Promise.all(
        personas.map((persona) => {
          const evaluator = createReaderEvaluator({ llmClient, soulText, persona });
          const prevEval = previousResult?.evaluations.find(e => e.personaId === persona.id);
          return evaluator.evaluate(text, prevEval);
        })
      );

      const aggregatedScore = calculateAggregatedScore(evaluations);
      const passed = aggregatedScore >= PASSING_THRESHOLD;
      const summary = generateSummary(evaluations, passed);

      return {
        evaluations,
        aggregatedScore,
        passed,
        summary,
      };
    },
  };
}

