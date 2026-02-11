import type { SoulText } from '../../soul/manager.js';
import type { CrossChapterState } from '../types.js';

export interface ChapterStateExtractorContextInput {
  soulText: SoulText;
  chapterText: string;
  chapterIndex: number;
  previousState?: CrossChapterState;
}

export function buildChapterStateExtractorContext(input: ChapterStateExtractorContextInput): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  ctx.chapterText = input.chapterText;
  ctx.chapterIndex = input.chapterIndex;

  if (input.previousState) {
    ctx.previousCharacterStates = input.previousState.characterStates;
    ctx.previousMotifWear = input.previousState.motifWear
      .filter(m => m.wearLevel === 'worn' || m.wearLevel === 'exhausted');
    ctx.previousSummaries = input.previousState.chapterSummaries;
  }

  const worldBible = input.soulText.worldBible;
  if (worldBible?.characters) {
    ctx.knownCharacterNames = Object.keys(worldBible.characters);
  }

  return ctx;
}
