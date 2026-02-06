import type { ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient } from '../llm/tooling.js';
import type { Plot } from '../schemas/plot.js';
import {
  type PlotterConfig,
  type PlotResult,
  type PlotterDeps,
  type Plotter,
} from './types.js';
import { buildPrompt } from '../template/composer.js';
import { buildPlotterContext } from './context/plotter-context.js';
import { parsePlotResponse } from './parsers/plotter-parser.js';

export { type PlotterConfig, type PlotResult };

const SUBMIT_PLOT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_plot',
    description: '物語のプロット構造を提出する',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        theme: { type: 'string' },
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              title: { type: 'string' },
              summary: { type: 'string' },
              key_events: { type: 'array', items: { type: 'string' } },
              target_length: { type: 'number' },
              variation_constraints: {
                type: 'object',
                properties: {
                  structure_type: { type: 'string' },
                  emotional_arc: { type: 'string' },
                  pacing: { type: 'string' },
                  deviation_from_previous: { type: 'string' },
                  motif_budget: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        motif: { type: 'string' },
                        max_uses: { type: 'number' },
                      },
                      required: ['motif', 'max_uses'],
                    },
                  },
                },
                required: ['structure_type', 'emotional_arc', 'pacing'],
              },
              epistemic_constraints: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    perspective: { type: 'string' },
                    constraints: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['perspective', 'constraints'],
                },
              },
            },
            required: ['index', 'title', 'summary', 'key_events', 'target_length'],
          },
        },
      },
      required: ['title', 'theme', 'chapters'],
    },
  },
};

/**
 * Create a functional Plotter from dependencies
 */
export function createPlotter(deps: PlotterDeps): Plotter {
  const { llmClient, soulText, config } = deps;

  return {
    generatePlot: async (): Promise<Plot> => {
      const context = buildPlotterContext({ soulText, config });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('plotter', context);

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_PLOT_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_plot' } },
          temperature: config.temperature,
        },
      );

      return parsePlotResponse(response);
    },
  };
}

