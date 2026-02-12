import type { Plot } from '../schemas/plot.js';
import type { LLMMessage } from '../llm/types.js';
import { PlotSkeletonSchema } from '../schemas/plot.js';
import {
  type PlotterConfig,
  type PlotResult,
  type PlotterDeps,
  type Plotter,
} from './types.js';
import { buildPrompt } from '../template/composer.js';
import { buildPlotterContext, buildChapterConstraintContext } from './context/plotter-context.js';
import { parsePlotSkeletonResponse, parseChapterConstraintsResponse, BatchChapterConstraintsSchema } from './parsers/plotter-parser.js';

export { type PlotterConfig, type PlotResult };

/**
 * Create a functional Plotter from dependencies.
 * Internally uses 2-phase generation as a multi-turn conversation:
 *   Phase 1: plot skeleton (title, theme, chapter basics)
 *   Phase 2: chapter constraints (variation + epistemic) — includes Phase 1 context
 */
export function createPlotter(deps: PlotterDeps): Plotter {
  const { llmClient, soulText, config } = deps;

  return {
    generatePlot: async (): Promise<Plot> => {
      // Phase 1: Generate plot skeleton
      const skeletonContext = buildPlotterContext({ soulText, config });
      const { system: skeletonSystem, user: skeletonUser } = buildPrompt('plotter', skeletonContext);

      const phase1Messages: LLMMessage[] = [
        { role: 'system', content: skeletonSystem },
        { role: 'user', content: skeletonUser },
      ];

      const skeletonResponse = await llmClient.completeStructured!(
        phase1Messages,
        PlotSkeletonSchema,
        { temperature: 1.0 },
      );

      const skeleton = parsePlotSkeletonResponse(skeletonResponse);

      // Phase 2: Generate chapter constraints (multi-turn conversation continuation)
      const constraintContext = buildChapterConstraintContext({ skeleton, config });
      const { user: constraintUser } = buildPrompt('plotter-constraints', constraintContext);

      // Build Phase 2 messages as continuation of Phase 1 conversation
      const phase2Messages: LLMMessage[] = [
        ...phase1Messages,
        {
          role: 'assistant' as const,
          content: JSON.stringify(skeletonResponse.data),
          ...(skeletonResponse.reasoning ? { reasoning: skeletonResponse.reasoning } : {}),
        },
        { role: 'user', content: constraintUser },
      ];

      let batchConstraints;
      try {
        const constraintResponse = await llmClient.completeStructured!(
          phase2Messages,
          BatchChapterConstraintsSchema,
          { temperature: 1.0 },
        );
        batchConstraints = parseChapterConstraintsResponse(constraintResponse);
      } catch (e) {
        console.warn('[plotter] Phase 2 constraints failed, using empty constraints:', e instanceof Error ? e.message : e);
        batchConstraints = { chapters: [] };
      }

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
