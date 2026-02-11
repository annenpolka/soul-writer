import type { ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient } from '../llm/tooling.js';
import type { DefectDetectorDeps, DefectDetectorFn } from './types.js';
import { buildPrompt } from '../template/composer.js';
import { buildDefectDetectorContext } from './context/defect-detector-context.js';
import { parseDefectDetectorResponse } from './parsers/defect-detector-parser.js';

const SUBMIT_DEFECTS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_defects',
    description: '検出した欠陥リストを提出する',
    parameters: {
      type: 'object',
      properties: {
        verdict_level: {
          type: 'string',
          enum: ['exceptional', 'publishable', 'acceptable', 'needs_work', 'unacceptable'],
          description: '総合的な品質裁定レベル',
        },
        defects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
              category: { type: 'string' },
              description: { type: 'string' },
              location: { type: 'string' },
              quoted_text: { type: 'string', description: '問題箇所の引用（原文から50〜150字）' },
              suggested_fix: { type: 'string', description: '具体的な修正案（「〜を〜に変更する」形式）' },
            },
            required: ['severity', 'category', 'description', 'location', 'quoted_text', 'suggested_fix'],
            additionalProperties: false,
          },
        },
      },
      required: ['defects', 'verdict_level'],
      additionalProperties: false,
    },
    strict: true,
  },
};

/**
 * Create a functional DefectDetector from dependencies
 */
export function createDefectDetector(deps: DefectDetectorDeps): DefectDetectorFn {
  const { llmClient, soulText, enrichedCharacters, toneDirective, crossChapterState, judgeWeaknesses, judgeAxisComments, complianceWarnings } = deps;

  return {
    detect: async (text: string) => {
      const context = buildDefectDetectorContext({ soulText, text, enrichedCharacters, toneDirective, crossChapterState, judgeWeaknesses, judgeAxisComments, complianceWarnings });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('defect-detector', context);

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_DEFECTS_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_defects' } },
          temperature: 0.3,
        },
      );

      return parseDefectDetectorResponse(response);
    },
  };
}
