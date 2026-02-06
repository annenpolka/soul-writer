import type { ToolCallResponse } from '../../llm/types.js';
import type { Plot, PlotSkeleton } from '../../schemas/plot.js';
import { PlotSchema, PlotSkeletonSchema, ChapterConstraintsSchema } from '../../schemas/plot.js';
import { z } from 'zod';
import { parseToolArguments } from '../../llm/tooling.js';

/**
 * Try to JSON.parse a value if it's a string, returning the original on failure.
 */
function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Coerce stringified array fields that LLMs sometimes return as JSON strings.
 * Returns a new object with coerced fields.
 */
export function coerceStringifiedArrays(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const obj = parsed as Record<string, unknown>;
  const result = { ...obj };
  let coerced = false;

  if (typeof result.chapters === 'string') {
    result.chapters = tryParseJson(result.chapters);
    coerced = true;
  }

  if (Array.isArray(result.chapters)) {
    result.chapters = (result.chapters as Record<string, unknown>[]).map((ch) => {
      const chResult = { ...ch };
      if (typeof chResult.key_events === 'string') {
        chResult.key_events = tryParseJson(chResult.key_events);
        coerced = true;
      }
      if (typeof chResult.motif_budget === 'string') {
        chResult.motif_budget = tryParseJson(chResult.motif_budget);
        coerced = true;
      }
      return chResult;
    });
  }

  if (coerced) {
    console.warn('[plotter-parser] Coerced stringified array fields from LLM response');
  }

  return result;
}

/**
 * Parse a tool-call response into a Plot (pure function).
 * Throws on parse failure or schema validation failure.
 */
export function parsePlotResponse(response: ToolCallResponse): Plot {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_plot');
  } catch {
    throw new Error('Failed to parse tool call arguments');
  }

  const coerced = coerceStringifiedArrays(parsed);

  const result = PlotSchema.safeParse(coerced);
  if (!result.success) {
    throw new Error(`Plot validation failed: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Parse Phase 1 response: plot skeleton without constraints.
 */
export function parsePlotSkeletonResponse(response: ToolCallResponse): PlotSkeleton {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_plot_skeleton');
  } catch {
    throw new Error('Failed to parse plot skeleton tool call arguments');
  }

  const coerced = coerceStringifiedArrays(parsed);

  const result = PlotSkeletonSchema.safeParse(coerced);
  if (!result.success) {
    throw new Error(`Plot skeleton validation failed: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Schema for batch chapter constraints response.
 */
const BatchChapterConstraintsSchema = z.object({
  chapters: z.array(z.object({
    index: z.number().int().positive(),
    variation_constraints: ChapterConstraintsSchema.shape.variation_constraints,
    epistemic_constraints: ChapterConstraintsSchema.shape.epistemic_constraints,
  })),
});

export type BatchChapterConstraints = z.infer<typeof BatchChapterConstraintsSchema>;

/**
 * Parse Phase 2 response: constraints for all chapters at once.
 */
export function parseChapterConstraintsResponse(response: ToolCallResponse): BatchChapterConstraints {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_chapter_constraints');
  } catch {
    console.warn('[plotter-parser] Chapter constraints parse failed, using empty constraints');
    return { chapters: [] };
  }

  const result = BatchChapterConstraintsSchema.safeParse(parsed);
  if (!result.success) {
    console.warn('[plotter-parser] Chapter constraints validation failed, using empty constraints:', result.error.message);
    return { chapters: [] };
  }

  return result.data;
}
