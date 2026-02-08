import type { ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient } from '../llm/tooling.js';
import type { JudgeResult, JudgeDeps, Judge } from './types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildPrompt } from '../template/composer.js';
import { buildJudgeContext } from './context/judge-context.js';
import { parseJudgeResponse } from './parsers/judge-parser.js';

export type { JudgeResult };

export const SUBMIT_JUDGEMENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_judgement',
    description: '勝者判定とスコアを提出する',
    parameters: {
      type: 'object',
      properties: {
        winner: { type: 'string', enum: ['A', 'B'] },
        reasoning: { type: 'string' },
        scores: {
          type: 'object',
          properties: {
            A: {
              type: 'object',
              properties: {
                style: { type: 'number' },
                compliance: { type: 'number' },
                overall: { type: 'number' },
                voice_accuracy: { type: 'number' },
                originality: { type: 'number' },
                structure: { type: 'number' },
                amplitude: { type: 'number' },
                agency: { type: 'number' },
                stakes: { type: 'number' },
              },
              required: ['style', 'compliance', 'overall'],
              additionalProperties: false,
            },
            B: {
              type: 'object',
              properties: {
                style: { type: 'number' },
                compliance: { type: 'number' },
                overall: { type: 'number' },
                voice_accuracy: { type: 'number' },
                originality: { type: 'number' },
                structure: { type: 'number' },
                amplitude: { type: 'number' },
                agency: { type: 'number' },
                stakes: { type: 'number' },
              },
              required: ['style', 'compliance', 'overall'],
              additionalProperties: false,
            },
          },
          required: ['A', 'B'],
          additionalProperties: false,
        },
        praised_excerpts: {
          type: 'object',
          properties: {
            A: { type: 'array', items: { type: 'string' } },
            B: { type: 'array', items: { type: 'string' } },
          },
          required: ['A', 'B'],
          additionalProperties: false,
        },
        weaknesses: {
          type: 'object',
          properties: {
            A: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string', enum: ['style', 'voice', 'pacing', 'imagery', 'motif', 'worldbuilding', 'agency', 'stakes'] },
                  description: { type: 'string' },
                  suggestedFix: { type: 'string' },
                  severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
                },
                required: ['category', 'description', 'suggestedFix', 'severity'],
                additionalProperties: false,
              },
            },
            B: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string', enum: ['style', 'voice', 'pacing', 'imagery', 'motif', 'worldbuilding', 'agency', 'stakes'] },
                  description: { type: 'string' },
                  suggestedFix: { type: 'string' },
                  severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
                },
                required: ['category', 'description', 'suggestedFix', 'severity'],
                additionalProperties: false,
              },
            },
          },
          required: ['A', 'B'],
          additionalProperties: false,
        },
        axis_comments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              axis: { type: 'string', enum: ['style', 'voice_accuracy', 'originality', 'structure', 'amplitude', 'agency', 'stakes', 'compliance'] },
              commentA: { type: 'string' },
              commentB: { type: 'string' },
              exampleA: { type: 'string' },
              exampleB: { type: 'string' },
            },
            required: ['axis', 'commentA', 'commentB', 'exampleA', 'exampleB'],
            additionalProperties: false,
          },
        },
        section_analysis: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section: { type: 'string' },
              ratingA: { type: 'string', enum: ['excellent', 'good', 'adequate', 'weak'] },
              ratingB: { type: 'string', enum: ['excellent', 'good', 'adequate', 'weak'] },
              commentA: { type: 'string' },
              commentB: { type: 'string' },
            },
            required: ['section', 'ratingA', 'ratingB', 'commentA', 'commentB'],
            additionalProperties: false,
          },
        },
      },
      required: ['winner', 'reasoning', 'scores'],
      additionalProperties: false,
    },
    strict: true,
  },
};

/**
 * Create a functional Judge from dependencies
 */
export function createJudge(deps: JudgeDeps): Judge {
  const { llmClient, soulText } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();
  const themeContext = deps.themeContext;

  return {
    evaluate: async (textA: string, textB: string): Promise<JudgeResult> => {
      const context = buildJudgeContext({ soulText, narrativeRules, textA, textB, themeContext });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('judge', context);

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_JUDGEMENT_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_judgement' } },
          temperature: 0.3,
        },
      );

      return parseJudgeResponse(response);
    },
  };
}

