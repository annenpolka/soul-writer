import type { DefectDetectorDeps, DefectDetectorFn } from './types.js';
import { buildPrompt } from '../template/composer.js';
import { buildDefectDetectorContext } from './context/defect-detector-context.js';
import { parseDefectDetectorResponse, createFallbackResult } from './parsers/defect-detector-parser.js';
import { DefectDetectorResponseSchema } from '../schemas/defect-detector-response.js';

/**
 * Create a functional DefectDetector from dependencies
 */
export function createDefectDetector(deps: DefectDetectorDeps): DefectDetectorFn {
  const { llmClient, soulText, enrichedCharacters, toneDirective, crossChapterState, judgeWeaknesses, judgeAxisComments, complianceWarnings, judgeReasoning } = deps;

  return {
    detect: async (text: string) => {
      const context = buildDefectDetectorContext({ soulText, text, enrichedCharacters, toneDirective, crossChapterState, judgeWeaknesses, judgeAxisComments, complianceWarnings, judgeReasoning });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('defect-detector', context);

      try {
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          DefectDetectorResponseSchema,
          { temperature: 1.0 },
        );

        return parseDefectDetectorResponse(response);
      } catch (e) {
        console.warn('[defect-detector] completeStructured failed, using fallback:', e instanceof Error ? e.message : e);
        return createFallbackResult();
      }
    },
  };
}
