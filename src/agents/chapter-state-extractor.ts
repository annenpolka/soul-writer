import type { ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient } from '../llm/tooling.js';
import type { ChapterStateExtractorDeps, ChapterStateExtractorFn } from './types.js';
import { buildPrompt } from '../template/composer.js';
import { buildChapterStateExtractorContext } from './context/chapter-state-extractor-context.js';
import { parseChapterStateExtractionResponse } from './parsers/chapter-state-extractor-parser.js';

const SUBMIT_CHAPTER_STATE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_chapter_state',
    description: '章から抽出したキャラクター状態・モチーフ・変奏ヒントを提出する',
    parameters: {
      type: 'object',
      properties: {
        character_states: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              character_name: { type: 'string', description: 'キャラクター名' },
              emotional_state: { type: 'string', description: '章末の感情状態' },
              knowledge_gained: {
                type: 'array',
                items: { type: 'string' },
                description: 'この章で得た知識・情報',
              },
              relationship_changes: {
                type: 'array',
                items: { type: 'string' },
                description: '関係性の変化',
              },
              physical_state: { type: 'string', description: '身体状態（怪我・疲労等）' },
            },
            required: ['character_name', 'emotional_state', 'knowledge_gained', 'relationship_changes'],
            additionalProperties: false,
          },
        },
        motif_occurrences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              motif: { type: 'string', description: 'モチーフ名' },
              count: { type: 'number', description: '出現回数' },
            },
            required: ['motif', 'count'],
            additionalProperties: false,
          },
        },
        next_variation_hint: { type: 'string', description: '次章への変奏ヒント' },
        chapter_summary: { type: 'string', description: '200字以内の章要約' },
        dominant_tone: { type: 'string', description: '支配的トーン' },
        peak_intensity: { type: 'number', description: 'ピーク強度（1-5）' },
      },
      required: ['character_states', 'motif_occurrences', 'next_variation_hint', 'chapter_summary', 'dominant_tone', 'peak_intensity'],
      additionalProperties: false,
    },
    strict: true,
  },
};

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

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_CHAPTER_STATE_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_chapter_state' } },
          temperature: 0.3,
        },
      );

      return parseChapterStateExtractionResponse(response);
    },
  };
}
