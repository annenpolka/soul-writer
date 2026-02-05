import { z } from 'zod';

/**
 * Variation constraints for a chapter - ensures structural diversity across chapters
 */
export const VariationConstraintsSchema = z.object({
  /** Structural type (e.g., "single_scene", "parallel_montage", "flashback_interleave") */
  structure_type: z.string().min(1),
  /** Emotional arc direction (e.g., "ascending", "descending", "oscillating") */
  emotional_arc: z.string().min(1),
  /** Pacing instruction (e.g., "slow_burn", "rapid_cuts", "deceleration") */
  pacing: z.string().min(1),
  /** Deviation mandate from previous chapter */
  deviation_from_previous: z.string().nullable().optional(),
  /** Motif budget: which motifs may appear and max repetition count */
  motif_budget: z.array(z.object({
    motif: z.string(),
    max_uses: z.number().int().positive(),
  })).optional(),
});

/**
 * Epistemic constraints for a perspective character - what they don't know or can't see
 */
export const EpistemicConstraintSchema = z.object({
  /** Name of the perspective character */
  perspective: z.string().min(1),
  /** List of things this character doesn't know or can't perceive */
  constraints: z.array(z.string()).min(1),
});

/**
 * Chapter schema - represents a single chapter in a plot
 */
export const ChapterSchema = z.object({
  index: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  key_events: z.array(z.string()).min(1),
  target_length: z.number().int().positive().default(4000),
  variation_constraints: VariationConstraintsSchema.optional(),
  epistemic_constraints: z.array(EpistemicConstraintSchema).optional(),
});

/**
 * Plot schema - represents a complete plot structure
 */
export const PlotSchema = z.object({
  title: z.string().min(1),
  theme: z.string().min(1),
  chapters: z.array(ChapterSchema).min(1),
});

export type VariationConstraints = z.infer<typeof VariationConstraintsSchema>;
export type EpistemicConstraint = z.infer<typeof EpistemicConstraintSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Plot = z.infer<typeof PlotSchema>;
