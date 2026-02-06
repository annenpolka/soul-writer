import type { ToolCallResponse } from '../../llm/types.js';
import type { Plot } from '../../schemas/plot.js';
import { PlotSchema } from '../../schemas/plot.js';
import { parseToolArguments } from '../../llm/tooling.js';

/**
 * Parse a tool-call response into a Plot (pure function).
 * Equivalent to PlotterAgent.parseToolResponse().
 * Throws on parse failure or schema validation failure.
 */
export function parsePlotResponse(response: ToolCallResponse): Plot {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_plot');
  } catch {
    throw new Error('Failed to parse tool call arguments');
  }

  const result = PlotSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Plot validation failed: ${result.error.message}`);
  }

  return result.data;
}
