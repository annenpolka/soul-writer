import { z } from 'zod';

export const ChapterStateResponseSchema = z.object({
  character_states: z.array(z.object({
    character_name: z.string(),
    emotional_state: z.string(),
    knowledge_gained: z.array(z.string()),
    relationship_changes: z.array(z.string()),
    physical_state: z.string().optional(),
  })),
  motif_occurrences: z.array(z.object({
    motif: z.string(),
    count: z.number(),
  })),
  next_variation_hint: z.string(),
  chapter_summary: z.string(),
  dominant_tone: z.string(),
  peak_intensity: z.number(),
});

export type ChapterStateRawResponse = z.infer<typeof ChapterStateResponseSchema>;
