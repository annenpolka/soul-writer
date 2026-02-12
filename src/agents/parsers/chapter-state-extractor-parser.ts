import type { StructuredResponse } from '../../llm/types.js';
import type { ChapterStateExtraction } from '../types.js';
import type { ChapterStateRawResponse } from '../../schemas/chapter-state-response.js';

/**
 * Parse a structured response into a ChapterStateExtraction (pure function).
 */
export function parseChapterStateExtractionResponse(response: StructuredResponse<ChapterStateRawResponse>): ChapterStateExtraction & { llmReasoning: string | null } {
  const data = response.data;

  return {
    characterStates: data.character_states.map((cs) => ({
      characterName: cs.character_name,
      emotionalState: cs.emotional_state,
      knowledgeGained: cs.knowledge_gained,
      relationshipChanges: cs.relationship_changes,
      ...(cs.physical_state ? { physicalState: cs.physical_state } : {}),
    })),
    motifOccurrences: data.motif_occurrences.map((mo) => ({
      motif: mo.motif,
      count: mo.count,
    })),
    nextVariationHint: data.next_variation_hint,
    chapterSummary: data.chapter_summary,
    dominantTone: data.dominant_tone,
    peakIntensity: Math.max(1, Math.min(5, data.peak_intensity)),
    llmReasoning: response.reasoning ?? null,
  };
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
