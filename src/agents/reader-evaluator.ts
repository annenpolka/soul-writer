import type { ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient } from '../llm/tooling.js';
import type { PersonaEvaluation, ReaderEvaluatorDeps, ReaderEval } from './types.js';
import { buildPrompt } from '../template/composer.js';
import { buildReaderEvalContext } from './context/reader-eval-context.js';
import { parseEvalToolResponse } from './parsers/reader-eval-parser.js';

const SUBMIT_READER_EVALUATION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_reader_evaluation',
    description: '読者評価のスコアとフィードバックを提出する',
    parameters: {
      type: 'object',
      properties: {
        categoryScores: {
          type: 'object',
          properties: {
            style: { type: 'number' },
            plot: { type: 'number' },
            character: { type: 'number' },
            worldbuilding: { type: 'number' },
            readability: { type: 'number' },
          },
          required: ['style', 'plot', 'character', 'worldbuilding', 'readability'],
          additionalProperties: false,
        },
        feedback: {
          type: 'object',
          properties: {
            strengths: { type: 'string' },
            weaknesses: { type: 'string' },
            suggestion: { type: 'string' },
          },
          required: ['strengths', 'weaknesses', 'suggestion'],
          additionalProperties: false,
        },
      },
      required: ['categoryScores', 'feedback'],
      additionalProperties: false,
    },
    strict: true,
  },
};

/**
 * Create a functional ReaderEvaluator from dependencies
 */
export function createReaderEvaluator(deps: ReaderEvaluatorDeps): ReaderEval {
  const { llmClient, persona } = deps;

  return {
    evaluate: async (text: string, previousEvaluation?: PersonaEvaluation): Promise<PersonaEvaluation> => {
      const context = buildReaderEvalContext({ persona, text, previousEvaluation });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('reader-evaluator', context);

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_READER_EVALUATION_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_reader_evaluation' } },
          temperature: 0.3,
        },
      );

      return parseEvalToolResponse(response, persona);
    },
  };
}

