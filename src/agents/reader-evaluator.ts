import type { PersonaEvaluation, ReaderEvaluatorDeps, ReaderEval } from './types.js';
import { buildPrompt } from '../template/composer.js';
import { buildReaderEvalContext } from './context/reader-eval-context.js';
import { parseEvalToolResponse, getDefaultScores, calculateWeightedScore } from './parsers/reader-eval-parser.js';
import { ReaderEvaluationResponseSchema } from '../schemas/reader-evaluation-response.js';

/**
 * Create a functional ReaderEvaluator from dependencies
 */
export function createReaderEvaluator(deps: ReaderEvaluatorDeps): ReaderEval {
  const { llmClient, persona } = deps;

  return {
    evaluate: async (text: string, previousEvaluation?: PersonaEvaluation): Promise<PersonaEvaluation> => {
      const context = buildReaderEvalContext({ persona, text, previousEvaluation });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('reader-evaluator', context);

      try {
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          ReaderEvaluationResponseSchema,
          { temperature: 1.0 },
        );

        return parseEvalToolResponse(response, persona);
      } catch (e) {
        console.warn('[reader-evaluator] completeStructured failed, using defaults:', e instanceof Error ? e.message : e);
        const categoryScores = getDefaultScores();
        return {
          personaId: persona.id,
          personaName: persona.name,
          categoryScores,
          weightedScore: calculateWeightedScore(categoryScores, persona.evaluation_weights),
          feedback: { strengths: '', weaknesses: 'structured output解析に失敗', suggestion: '' },
        };
      }
    },
  };
}
