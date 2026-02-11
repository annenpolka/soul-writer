import type { CrossChapterState, ChapterStateExtraction, MotifWearEntry, WearLevel } from '../agents/types.js';

export function createInitialCrossChapterState(): CrossChapterState {
  return {
    characterStates: [],
    motifWear: [],
    variationHint: null,
    chapterSummaries: [],
  };
}

export function calculateWearLevel(usageCount: number): WearLevel {
  if (usageCount <= 1) return 'fresh';
  if (usageCount <= 3) return 'used';
  if (usageCount <= 5) return 'worn';
  return 'exhausted';
}

export function calculateMotifWear(
  currentWear: MotifWearEntry[],
  newOccurrences: Array<{ motif: string; count: number }>,
  chapterIndex: number,
): MotifWearEntry[] {
  const wearMap = new Map(currentWear.map(w => [w.motif, w]));

  for (const occ of newOccurrences) {
    const existing = wearMap.get(occ.motif);
    if (existing) {
      const newCount = existing.usageCount + occ.count;
      wearMap.set(occ.motif, {
        motif: occ.motif,
        usageCount: newCount,
        lastUsedChapter: chapterIndex,
        wearLevel: calculateWearLevel(newCount),
      });
    } else {
      wearMap.set(occ.motif, {
        motif: occ.motif,
        usageCount: occ.count,
        lastUsedChapter: chapterIndex,
        wearLevel: calculateWearLevel(occ.count),
      });
    }
  }

  return Array.from(wearMap.values());
}

export function updateCrossChapterState(
  currentState: CrossChapterState,
  extraction: ChapterStateExtraction,
  chapterIndex: number,
): CrossChapterState {
  return {
    characterStates: extraction.characterStates,
    motifWear: calculateMotifWear(currentState.motifWear, extraction.motifOccurrences, chapterIndex),
    variationHint: extraction.nextVariationHint,
    chapterSummaries: [
      ...currentState.chapterSummaries,
      {
        chapterIndex,
        summary: extraction.chapterSummary,
        dominantTone: extraction.dominantTone,
        peakIntensity: extraction.peakIntensity,
      },
    ],
  };
}
