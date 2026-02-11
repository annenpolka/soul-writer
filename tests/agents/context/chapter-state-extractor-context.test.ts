import { describe, it, expect } from 'vitest';
import { buildChapterStateExtractorContext } from '../../../src/agents/context/chapter-state-extractor-context.js';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import type { CrossChapterState } from '../../../src/agents/types.js';

describe('buildChapterStateExtractorContext', () => {
  it('should include chapterText and chapterIndex', () => {
    const result = buildChapterStateExtractorContext({
      soulText: createMockSoulText(),
      chapterText: 'テスト章テキスト',
      chapterIndex: 2,
    });

    expect(result.chapterText).toBe('テスト章テキスト');
    expect(result.chapterIndex).toBe(2);
  });

  it('should not include previous state fields when no previousState', () => {
    const result = buildChapterStateExtractorContext({
      soulText: createMockSoulText(),
      chapterText: 'text',
      chapterIndex: 0,
    });

    expect(result.previousCharacterStates).toBeUndefined();
    expect(result.previousMotifWear).toBeUndefined();
    expect(result.previousSummaries).toBeUndefined();
  });

  it('should include previousCharacterStates when previousState provided', () => {
    const previousState: CrossChapterState = {
      characterStates: [
        { characterName: '透心', emotionalState: '怒り', knowledgeGained: [], relationshipChanges: [] },
      ],
      motifWear: [],
      variationHint: null,
      chapterSummaries: [],
    };

    const result = buildChapterStateExtractorContext({
      soulText: createMockSoulText(),
      chapterText: 'text',
      chapterIndex: 1,
      previousState,
    });

    expect(result.previousCharacterStates).toEqual(previousState.characterStates);
  });

  it('should filter motif wear to only worn and exhausted', () => {
    const previousState: CrossChapterState = {
      characterStates: [],
      motifWear: [
        { motif: 'fresh motif', usageCount: 1, lastUsedChapter: 0, wearLevel: 'fresh' },
        { motif: 'used motif', usageCount: 3, lastUsedChapter: 0, wearLevel: 'used' },
        { motif: 'worn motif', usageCount: 5, lastUsedChapter: 0, wearLevel: 'worn' },
        { motif: 'exhausted motif', usageCount: 7, lastUsedChapter: 0, wearLevel: 'exhausted' },
      ],
      variationHint: null,
      chapterSummaries: [],
    };

    const result = buildChapterStateExtractorContext({
      soulText: createMockSoulText(),
      chapterText: 'text',
      chapterIndex: 1,
      previousState,
    });

    const filtered = result.previousMotifWear as Array<{ motif: string }>;
    expect(filtered).toHaveLength(2);
    expect(filtered.map(m => m.motif)).toEqual(['worn motif', 'exhausted motif']);
  });

  it('should include previousSummaries when previousState provided', () => {
    const previousState: CrossChapterState = {
      characterStates: [],
      motifWear: [],
      variationHint: null,
      chapterSummaries: [
        { chapterIndex: 0, summary: '第1章要約', dominantTone: '静', peakIntensity: 2 },
      ],
    };

    const result = buildChapterStateExtractorContext({
      soulText: createMockSoulText(),
      chapterText: 'text',
      chapterIndex: 1,
      previousState,
    });

    expect(result.previousSummaries).toEqual(previousState.chapterSummaries);
  });

  it('should extract knownCharacterNames from world bible', () => {
    const soulText = createMockSoulText({
      characters: {
        '透心': { role: '主人公' },
        'つるぎ': { role: 'ハッカー' },
      },
    });

    const result = buildChapterStateExtractorContext({
      soulText,
      chapterText: 'text',
      chapterIndex: 0,
    });

    expect(result.knownCharacterNames).toEqual(['透心', 'つるぎ']);
  });

  it('should not include knownCharacterNames when world bible has no characters', () => {
    const soulText = createMockSoulText();
    // default mock has empty characters object
    const result = buildChapterStateExtractorContext({
      soulText,
      chapterText: 'text',
      chapterIndex: 0,
    });

    // Object.keys({}) returns []
    expect(result.knownCharacterNames).toEqual([]);
  });
});
