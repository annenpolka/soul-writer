import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChapterStateExtractor } from '../../src/agents/chapter-state-extractor.js';
import type { ChapterStateExtractorDeps } from '../../src/agents/types.js';
import type { ChapterStateRawResponse } from '../../src/schemas/chapter-state-response.js';
import { createMockLLMClientWithStructured } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockChapterStateExtractorDeps(overrides?: {
  structuredData?: ChapterStateRawResponse;
  tokenCount?: number;
}): ChapterStateExtractorDeps {
  const defaultData: ChapterStateRawResponse = {
    character_states: [
      {
        character_name: '透心',
        emotional_state: '不安',
        knowledge_gained: ['秘密'],
        relationship_changes: ['つるぎとの距離が縮まった'],
      },
    ],
    motif_occurrences: [{ motif: 'ARタグ', count: 2 }],
    next_variation_hint: 'テンポを変える',
    chapter_summary: '透心が秘密を知る章',
    dominant_tone: '緊張',
    peak_intensity: 4,
  };

  return {
    llmClient: createMockLLMClientWithStructured(
      overrides?.structuredData ?? defaultData,
      { tokenCount: overrides?.tokenCount ?? 100 },
    ),
    soulText: createMockSoulText(),
  };
}

describe('createChapterStateExtractor (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a ChapterStateExtractorFn with extract method', () => {
    const deps = createMockChapterStateExtractorDeps();
    const extractor = createChapterStateExtractor(deps);
    expect(extractor.extract).toBeInstanceOf(Function);
  });

  it('extract() should call completeStructured', async () => {
    const deps = createMockChapterStateExtractorDeps();
    const extractor = createChapterStateExtractor(deps);
    await extractor.extract('テスト章テキスト', 0);
    expect(deps.llmClient.completeStructured).toHaveBeenCalledTimes(1);
  });

  it('extract() should return parsed ChapterStateExtraction', async () => {
    const deps = createMockChapterStateExtractorDeps();
    const extractor = createChapterStateExtractor(deps);
    const result = await extractor.extract('テスト', 0);

    expect(result.characterStates).toHaveLength(1);
    expect(result.characterStates[0].characterName).toBe('透心');
    expect(result.motifOccurrences).toHaveLength(1);
    expect(result.motifOccurrences[0].motif).toBe('ARタグ');
    expect(result.nextVariationHint).toBe('テンポを変える');
    expect(result.chapterSummary).toBe('透心が秘密を知る章');
    expect(result.dominantTone).toBe('緊張');
    expect(result.peakIntensity).toBe(4);
  });

  it('extract() should use temperature 1.0', async () => {
    const deps = createMockChapterStateExtractorDeps();
    const extractor = createChapterStateExtractor(deps);
    await extractor.extract('テスト', 0);

    const call = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = call[2] as { temperature?: number };
    expect(options.temperature).toBe(1.0);
  });

  it('extract() should handle empty response gracefully', async () => {
    const deps = createMockChapterStateExtractorDeps({
      structuredData: {
        character_states: [],
        motif_occurrences: [],
        next_variation_hint: '',
        chapter_summary: '',
        dominant_tone: '',
        peak_intensity: 3,
      },
    });
    const extractor = createChapterStateExtractor(deps);
    const result = await extractor.extract('テスト', 0);

    expect(result.characterStates).toEqual([]);
    expect(result.motifOccurrences).toEqual([]);
    expect(result.peakIntensity).toBe(3);
  });
});
