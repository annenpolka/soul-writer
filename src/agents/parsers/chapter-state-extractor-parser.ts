import type { ToolCallResponse } from '../../llm/types.js';
import type { ChapterStateExtraction, CharacterState } from '../types.js';
import { parseToolArguments } from '../../llm/tooling.js';

/**
 * Parse a tool-call response into a ChapterStateExtraction (pure function).
 */
export function parseChapterStateExtractionResponse(response: ToolCallResponse): ChapterStateExtraction {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_chapter_state');
  } catch (e) {
    console.warn('[chapter-state-extractor-parser] Tool call parsing failed:', e instanceof Error ? e.message : e);
    return createFallbackExtraction();
  }

  try {
    const candidate = parsed as Record<string, unknown>;

    const characterStates: CharacterState[] = Array.isArray(candidate.character_states)
      ? candidate.character_states
          .filter((cs): cs is Record<string, unknown> => typeof cs === 'object' && cs !== null)
          .map((cs) => ({
            characterName: String(cs.character_name ?? ''),
            emotionalState: String(cs.emotional_state ?? ''),
            knowledgeGained: Array.isArray(cs.knowledge_gained)
              ? cs.knowledge_gained.map(String)
              : [],
            relationshipChanges: Array.isArray(cs.relationship_changes)
              ? cs.relationship_changes.map(String)
              : [],
            ...(cs.physical_state ? { physicalState: String(cs.physical_state) } : {}),
          }))
      : [];

    const motifOccurrences: Array<{ motif: string; count: number }> = Array.isArray(candidate.motif_occurrences)
      ? candidate.motif_occurrences
          .filter((mo): mo is Record<string, unknown> => typeof mo === 'object' && mo !== null)
          .map((mo) => ({
            motif: String(mo.motif ?? ''),
            count: typeof mo.count === 'number' ? mo.count : 1,
          }))
      : [];

    const nextVariationHint = typeof candidate.next_variation_hint === 'string'
      ? candidate.next_variation_hint
      : '';

    const chapterSummary = typeof candidate.chapter_summary === 'string'
      ? candidate.chapter_summary
      : '';

    const dominantTone = typeof candidate.dominant_tone === 'string'
      ? candidate.dominant_tone
      : '';

    const peakIntensity = typeof candidate.peak_intensity === 'number'
      ? Math.max(1, Math.min(5, candidate.peak_intensity))
      : 3;

    return {
      characterStates,
      motifOccurrences,
      nextVariationHint,
      chapterSummary,
      dominantTone,
      peakIntensity,
    };
  } catch (e) {
    console.warn('[chapter-state-extractor-parser] Response structure parsing failed:', e instanceof Error ? e.message : e);
    return createFallbackExtraction();
  }
}

/**
 * Create a fallback ChapterStateExtraction when parsing fails (pure function).
 */
export function createFallbackExtraction(): ChapterStateExtraction {
  return {
    characterStates: [],
    motifOccurrences: [],
    nextVariationHint: '',
    chapterSummary: '',
    dominantTone: '',
    peakIntensity: 3,
  };
}
