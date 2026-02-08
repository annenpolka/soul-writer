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
        defects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
              category: { type: 'string' },
              description: { type: 'string' },
              location: { type: 'string' },
            },
            required: ['severity', 'category', 'description', 'location'],
            additionalProperties: false,
          },
        },
      },
      required: ['defects'],
      additionalProperties: false,
    },
    strict: true,
  },
};

/**
 * Create a functional DefectDetector from dependencies
 */
export function createDefectDetector(deps: DefectDetectorDeps): DefectDetectorFn {
  const { llmClient, soulText } = deps;

  return {
    detect: async (text: string) => {
      const context = buildDefectDetectorContext({ soulText, text });
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
