import { describe, it, expect } from 'vitest';
import {
  parseChapterStateExtractionResponse,
  createFallbackExtraction,
} from '../../../src/agents/parsers/chapter-state-extractor-parser.js';
import type { StructuredResponse } from '../../../src/llm/types.js';
import type { ChapterStateRawResponse } from '../../../src/schemas/chapter-state-response.js';

function makeStructuredResponse(data: ChapterStateRawResponse): StructuredResponse<ChapterStateRawResponse> {
  return {
    data,
    reasoning: null,
    tokensUsed: 50,
  };
}

describe('parseChapterStateExtractionResponse', () => {
  it('should parse a complete valid response', () => {
    const response = makeStructuredResponse({
      character_states: [
        {
          character_name: '透心',
          emotional_state: '不安と期待',
          knowledge_gained: ['つるぎの正体'],
          relationship_changes: ['つるぎとの信頼が深まった'],
          physical_state: '軽い疲労',
        },
      ],
      motif_occurrences: [
        { motif: 'ARタグ', count: 3 },
        { motif: '視線', count: 2 },
      ],
      next_variation_hint: 'テンポを上げ、対話中心に切り替える',
      chapter_summary: '透心がつるぎの秘密を垣間見る',
      dominant_tone: '緊迫',
      peak_intensity: 4,
    });

    const result = parseChapterStateExtractionResponse(response);

    expect(result.characterStates).toHaveLength(1);
    expect(result.characterStates[0].characterName).toBe('透心');
    expect(result.characterStates[0].emotionalState).toBe('不安と期待');
    expect(result.characterStates[0].knowledgeGained).toEqual(['つるぎの正体']);
    expect(result.characterStates[0].relationshipChanges).toEqual(['つるぎとの信頼が深まった']);
    expect(result.characterStates[0].physicalState).toBe('軽い疲労');

    expect(result.motifOccurrences).toHaveLength(2);
    expect(result.motifOccurrences[0]).toEqual({ motif: 'ARタグ', count: 3 });

    expect(result.nextVariationHint).toBe('テンポを上げ、対話中心に切り替える');
    expect(result.chapterSummary).toBe('透心がつるぎの秘密を垣間見る');
    expect(result.dominantTone).toBe('緊迫');
    expect(result.peakIntensity).toBe(4);
  });

  it('should handle character_states without physical_state', () => {
    const response = makeStructuredResponse({
      character_states: [
        {
          character_name: '透心',
          emotional_state: '静か',
          knowledge_gained: [],
          relationship_changes: [],
        },
      ],
      motif_occurrences: [],
      next_variation_hint: '',
      chapter_summary: '',
      dominant_tone: '',
      peak_intensity: 3,
    });

    const result = parseChapterStateExtractionResponse(response);
    expect(result.characterStates[0].physicalState).toBeUndefined();
  });

  it('should capture LLM reasoning from response', () => {
    const response: StructuredResponse<ChapterStateRawResponse> = {
      data: {
        character_states: [],
        motif_occurrences: [],
        next_variation_hint: '',
        chapter_summary: '',
        dominant_tone: '',
        peak_intensity: 3,
      },
      reasoning: 'ChapterState推論: キャラクター変化を分析した',
      tokensUsed: 50,
    };
    const result = parseChapterStateExtractionResponse(response);

    expect(result.llmReasoning).toBe('ChapterState推論: キャラクター変化を分析した');
  });

  it('should set llmReasoning to null when response.reasoning is null', () => {
    const response = makeStructuredResponse({
      character_states: [],
      motif_occurrences: [],
      next_variation_hint: '',
      chapter_summary: '',
      dominant_tone: '',
      peak_intensity: 3,
    });
    const result = parseChapterStateExtractionResponse(response);

    expect(result.llmReasoning).toBeNull();
  });

  it('should clamp peak_intensity to 1-5 range', () => {
    const responseLow = makeStructuredResponse({
      character_states: [],
      motif_occurrences: [],
      next_variation_hint: '',
      chapter_summary: '',
      dominant_tone: '',
      peak_intensity: -1,
    });
    expect(parseChapterStateExtractionResponse(responseLow).peakIntensity).toBe(1);

    const responseHigh = makeStructuredResponse({
      character_states: [],
      motif_occurrences: [],
      next_variation_hint: '',
      chapter_summary: '',
      dominant_tone: '',
      peak_intensity: 10,
    });
    expect(parseChapterStateExtractionResponse(responseHigh).peakIntensity).toBe(5);
  });
});

describe('createFallbackExtraction', () => {
  it('should return safe default values', () => {
    const fallback = createFallbackExtraction();
    expect(fallback.characterStates).toEqual([]);
    expect(fallback.motifOccurrences).toEqual([]);
    expect(fallback.nextVariationHint).toBe('');
    expect(fallback.chapterSummary).toBe('');
    expect(fallback.dominantTone).toBe('');
    expect(fallback.peakIntensity).toBe(3);
  });
});
