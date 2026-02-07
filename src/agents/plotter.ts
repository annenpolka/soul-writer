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
import { buildPlotterContext, buildChapterConstraintContext } from './context/plotter-context.js';
import { parsePlotSkeletonResponse, parseChapterConstraintsResponse } from './parsers/plotter-parser.js';

export { type PlotterConfig, type PlotResult };

/**
 * Phase 1 tool: submit plot skeleton (title, theme, chapters basics)
 */
const SUBMIT_PLOT_SKELETON_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_plot_skeleton',
    description: '物語のプロット骨格を提出する（章の基本情報のみ）',
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
              dramaturgy: { type: 'string' },
              arc_role: { type: 'string' },
            },
            required: ['index', 'title', 'summary', 'key_events', 'target_length', 'dramaturgy', 'arc_role'],
          },
        },
      },
      required: ['title', 'theme', 'chapters'],
    },
  },
};

/**
 * Phase 2 tool: submit chapter constraints (variation + epistemic)
 */
const SUBMIT_CHAPTER_CONSTRAINTS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_chapter_constraints',
    description: '各章の変奏制約と認識制約を提出する',
    parameters: {
      type: 'object',
      properties: {
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
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
                  emotional_beats: { type: 'array', items: { type: 'string' } },
                  forbidden_patterns: { type: 'array', items: { type: 'string' } },
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
            required: ['index'],
          },
        },
      },
      required: ['chapters'],
    },
  },
};

/**
 * Create a functional Plotter from dependencies.
 * Internally uses 2-phase generation:
 *   Phase 1: plot skeleton (title, theme, chapter basics)
 *   Phase 2: chapter constraints (variation + epistemic)
 */
export function createPlotter(deps: PlotterDeps): Plotter {
  const { llmClient, soulText, config } = deps;

  return {
    generatePlot: async (): Promise<Plot> => {
      assertToolCallingClient(llmClient);

      // Phase 1: Generate plot skeleton
      const skeletonContext = buildPlotterContext({ soulText, config });
      const { system: skeletonSystem, user: skeletonUser } = buildPrompt('plotter', skeletonContext);

      const skeletonResponse = await llmClient.completeWithTools(
        skeletonSystem,
        skeletonUser,
        [SUBMIT_PLOT_SKELETON_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_plot_skeleton' } },
          temperature: config.temperature,
        },
      );

      const skeleton = parsePlotSkeletonResponse(skeletonResponse);

      // Phase 2: Generate chapter constraints
      const constraintContext = buildChapterConstraintContext({ skeleton, config });
      const { system: constraintSystem, user: constraintUser } = buildPrompt('plotter-constraints', constraintContext);

      const constraintResponse = await llmClient.completeWithTools(
        constraintSystem,
        constraintUser,
        [SUBMIT_CHAPTER_CONSTRAINTS_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_chapter_constraints' } },
          temperature: config.temperature,
        },
      );

      const batchConstraints = parseChapterConstraintsResponse(constraintResponse);

      // Merge skeleton + constraints into final Plot
      const constraintMap = new Map(
        batchConstraints.chapters.map(c => [c.index, c]),
      );

      const chapters = skeleton.chapters.map(ch => {
        const constraints = constraintMap.get(ch.index);
        return {
          ...ch,
          variation_constraints: constraints?.variation_constraints,
          epistemic_constraints: constraints?.epistemic_constraints,
        };
      });

      return {
        title: skeleton.title,
        theme: skeleton.theme,
        chapters,
      };
    },
  };
}
