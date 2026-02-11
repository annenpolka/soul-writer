import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChapterStateExtractor } from '../../src/agents/chapter-state-extractor.js';
import type { ChapterStateExtractorDeps } from '../../src/agents/types.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockChapterStateExtractorDeps(overrides?: {
  toolResponse?: { name: string; arguments: Record<string, unknown> };
  tokenCount?: number;
}): ChapterStateExtractorDeps {
  const defaultToolResponse = {
    name: 'submit_chapter_state',
    arguments: {
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
    },
  };

  return {
    llmClient: createMockLLMClientWithTools(
      overrides?.toolResponse ?? defaultToolResponse,
      overrides?.tokenCount ?? 100,
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

  it('extract() should call completeWithTools', async () => {
    const deps = createMockChapterStateExtractorDeps();
    const extractor = createChapterStateExtractor(deps);
    await extractor.extract('テスト章テキスト', 0);
    expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('extract() should pass the chapter text in the user prompt', async () => {
    const deps = createMockChapterStateExtractorDeps();
    const extractor = createChapterStateExtractor(deps);
    await extractor.extract('物語のテキストここに', 1);
    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toContain('物語のテキストここに');
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

  it('extract() should use submit_chapter_state tool with strict mode', async () => {
    const deps = createMockChapterStateExtractorDeps();
    const extractor = createChapterStateExtractor(deps);
    await extractor.extract('テスト', 0);

    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    const tools = call[2] as Array<{ type: string; function: { name: string; strict?: boolean } }>;
    expect(tools).toHaveLength(1);
    expect(tools[0].function.name).toBe('submit_chapter_state');
    expect(tools[0].function.strict).toBe(true);
  });

  it('extract() should use temperature 0.3', async () => {
    const deps = createMockChapterStateExtractorDeps();
    const extractor = createChapterStateExtractor(deps);
    await extractor.extract('テスト', 0);

    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = call[3] as { temperature?: number };
    expect(options.temperature).toBe(0.3);
  });

  it('extract() should handle empty response gracefully', async () => {
    const deps = createMockChapterStateExtractorDeps({
      toolResponse: {
        name: 'submit_chapter_state',
        arguments: {
          character_states: [],
          motif_occurrences: [],
          next_variation_hint: '',
          chapter_summary: '',
          dominant_tone: '',
          peak_intensity: 3,
        },
      },
    });
    const extractor = createChapterStateExtractor(deps);
    const result = await extractor.extract('テスト', 0);

    expect(result.characterStates).toEqual([]);
    expect(result.motifOccurrences).toEqual([]);
    expect(result.peakIntensity).toBe(3);
  });
});
