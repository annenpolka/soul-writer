import { describe, it, expect } from 'vitest';
import {
  createInitialCrossChapterState,
  calculateWearLevel,
  calculateMotifWear,
  updateCrossChapterState,
} from '../../src/pipeline/cross-chapter-state.js';
import type { CrossChapterState, ChapterStateExtraction, MotifWearEntry } from '../../src/agents/types.js';

describe('createInitialCrossChapterState', () => {
  it('should return empty initial state', () => {
    const state = createInitialCrossChapterState();
    expect(state.characterStates).toEqual([]);
    expect(state.motifWear).toEqual([]);
    expect(state.variationHint).toBeNull();
    expect(state.chapterSummaries).toEqual([]);
  });
});

describe('calculateWearLevel', () => {
  it('should return fresh for usageCount 0', () => {
    expect(calculateWearLevel(0)).toBe('fresh');
  });

  it('should return fresh for usageCount 1', () => {
    expect(calculateWearLevel(1)).toBe('fresh');
  });

  it('should return used for usageCount 2', () => {
    expect(calculateWearLevel(2)).toBe('used');
  });

  it('should return used for usageCount 3', () => {
    expect(calculateWearLevel(3)).toBe('used');
  });

  it('should return worn for usageCount 4', () => {
    expect(calculateWearLevel(4)).toBe('worn');
  });

  it('should return worn for usageCount 5', () => {
    expect(calculateWearLevel(5)).toBe('worn');
  });

  it('should return exhausted for usageCount 6', () => {
    expect(calculateWearLevel(6)).toBe('exhausted');
  });

  it('should return exhausted for usageCount 10', () => {
    expect(calculateWearLevel(10)).toBe('exhausted');
  });
});

describe('calculateMotifWear', () => {
  it('should add new motifs with correct wear level', () => {
    const result = calculateMotifWear([], [{ motif: 'AR tag', count: 1 }], 0);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      motif: 'AR tag',
      usageCount: 1,
      lastUsedChapter: 0,
      wearLevel: 'fresh',
    });
  });

  it('should update existing motifs by accumulating counts', () => {
    const existing: MotifWearEntry[] = [
      { motif: 'AR tag', usageCount: 2, lastUsedChapter: 0, wearLevel: 'used' },
    ];
    const result = calculateMotifWear(existing, [{ motif: 'AR tag', count: 2 }], 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      motif: 'AR tag',
      usageCount: 4,
      lastUsedChapter: 1,
      wearLevel: 'worn',
    });
  });

  it('should handle mix of new and existing motifs', () => {
    const existing: MotifWearEntry[] = [
      { motif: 'AR tag', usageCount: 1, lastUsedChapter: 0, wearLevel: 'fresh' },
    ];
    const result = calculateMotifWear(
      existing,
      [
        { motif: 'AR tag', count: 1 },
        { motif: 'lion', count: 3 },
      ],
      1,
    );
    expect(result).toHaveLength(2);
    const arTag = result.find(r => r.motif === 'AR tag');
    const lion = result.find(r => r.motif === 'lion');
    expect(arTag?.usageCount).toBe(2);
    expect(arTag?.wearLevel).toBe('used');
    expect(lion?.usageCount).toBe(3);
    expect(lion?.wearLevel).toBe('used');
  });

  it('should preserve motifs not in new occurrences', () => {
    const existing: MotifWearEntry[] = [
      { motif: 'old motif', usageCount: 5, lastUsedChapter: 0, wearLevel: 'worn' },
    ];
    const result = calculateMotifWear(existing, [{ motif: 'new motif', count: 1 }], 1);
    expect(result).toHaveLength(2);
    const old = result.find(r => r.motif === 'old motif');
    expect(old?.usageCount).toBe(5);
    expect(old?.lastUsedChapter).toBe(0);
  });
});

describe('updateCrossChapterState', () => {
  it('should replace characterStates with extraction', () => {
    const current = createInitialCrossChapterState();
    const extraction: ChapterStateExtraction = {
      characterStates: [
        { characterName: '透心', emotionalState: '不安', knowledgeGained: ['秘密'], relationshipChanges: [] },
      ],
      motifOccurrences: [],
      nextVariationHint: 'テンポを上げる',
      chapterSummary: '透心が秘密を知る',
      dominantTone: '緊張',
      peakIntensity: 4,
    };

    const result = updateCrossChapterState(current, extraction, 0);
    expect(result.characterStates).toEqual(extraction.characterStates);
  });

  it('should accumulate motif wear across chapters', () => {
    const current: CrossChapterState = {
      characterStates: [],
      motifWear: [{ motif: 'AR tag', usageCount: 2, lastUsedChapter: 0, wearLevel: 'used' }],
      variationHint: null,
      chapterSummaries: [],
    };
    const extraction: ChapterStateExtraction = {
      characterStates: [],
      motifOccurrences: [{ motif: 'AR tag', count: 3 }],
      nextVariationHint: '',
      chapterSummary: '',
      dominantTone: '',
      peakIntensity: 3,
    };

    const result = updateCrossChapterState(current, extraction, 1);
    expect(result.motifWear[0].usageCount).toBe(5);
    expect(result.motifWear[0].wearLevel).toBe('worn');
  });

  it('should update variationHint', () => {
    const current = createInitialCrossChapterState();
    const extraction: ChapterStateExtraction = {
      characterStates: [],
      motifOccurrences: [],
      nextVariationHint: '視点を変える',
      chapterSummary: '',
      dominantTone: '',
      peakIntensity: 3,
    };

    const result = updateCrossChapterState(current, extraction, 0);
    expect(result.variationHint).toBe('視点を変える');
  });

  it('should append chapter summaries', () => {
    const current: CrossChapterState = {
      characterStates: [],
      motifWear: [],
      variationHint: null,
      chapterSummaries: [{ chapterIndex: 0, summary: '第1章', dominantTone: '静', peakIntensity: 2 }],
    };
    const extraction: ChapterStateExtraction = {
      characterStates: [],
      motifOccurrences: [],
      nextVariationHint: '',
      chapterSummary: '第2章',
      dominantTone: '動',
      peakIntensity: 4,
    };

    const result = updateCrossChapterState(current, extraction, 1);
    expect(result.chapterSummaries).toHaveLength(2);
    expect(result.chapterSummaries[1]).toEqual({
      chapterIndex: 1,
      summary: '第2章',
      dominantTone: '動',
      peakIntensity: 4,
    });
  });
});
