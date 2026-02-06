import type { ToolCallResponse } from '../../llm/types.js';
import type { Plot } from '../../schemas/plot.js';
import { PlotSchema } from '../../schemas/plot.js';
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
