import type { ChapterStateExtractorDeps, ChapterStateExtractorFn } from './types.js';
import { buildPrompt } from '../template/composer.js';
import { buildChapterStateExtractorContext } from './context/chapter-state-extractor-context.js';
import { parseChapterStateExtractionResponse, createFallbackExtraction } from './parsers/chapter-state-extractor-parser.js';
import { ChapterStateResponseSchema } from '../schemas/chapter-state-response.js';

/**
 * Create a functional ChapterStateExtractor from dependencies
 */
export function createChapterStateExtractor(deps: ChapterStateExtractorDeps): ChapterStateExtractorFn {
  const { llmClient, soulText, previousState } = deps;

  return {
    extract: async (chapterText: string, chapterIndex: number) => {
      const context = buildChapterStateExtractorContext({
        soulText,
        chapterText,
        chapterIndex,
        previousState,
      });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('chapter-state-extractor', context);

      try {
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          ChapterStateResponseSchema,
          { temperature: 1.0 },
        );

        return parseChapterStateExtractionResponse(response);
      } catch (e) {
        console.warn('[chapter-state-extractor] completeStructured failed, using fallback:', e instanceof Error ? e.message : e);
        return createFallbackExtraction();
      }
    },
  };
}
