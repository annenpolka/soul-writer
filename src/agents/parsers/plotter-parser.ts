import type { StructuredResponse } from '../../llm/types.js';
import type { Plot, PlotSkeleton } from '../../schemas/plot.js';
import { PlotSchema, PlotSkeletonSchema, ChapterConstraintsSchema } from '../../schemas/plot.js';
import { z } from 'zod';

/**
 * Parse a structured response into a PlotSkeleton (pure function).
 * With constrained decoding, the data is already validated by the schema.
 */
export function parsePlotSkeletonResponse(response: StructuredResponse<PlotSkeleton>): PlotSkeleton {
  return response.data;
}

/**
 * Schema for batch chapter constraints response.
 */
export const BatchChapterConstraintsSchema = z.object({
  chapters: z.array(z.object({
    index: z.number().int().positive(),
    variation_constraints: ChapterConstraintsSchema.shape.variation_constraints,
    epistemic_constraints: ChapterConstraintsSchema.shape.epistemic_constraints,
  })),
});

export type BatchChapterConstraints = z.infer<typeof BatchChapterConstraintsSchema>;

/**
 * Parse a structured response into BatchChapterConstraints (pure function).
 */
export function parseChapterConstraintsResponse(response: StructuredResponse<BatchChapterConstraints>): BatchChapterConstraints {
  return response.data;
}
