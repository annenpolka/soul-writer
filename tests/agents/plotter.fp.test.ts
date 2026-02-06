import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlotter } from '../../src/agents/plotter.js';
import type { PlotterDeps, PlotterConfig } from '../../src/agents/types.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

const VALID_SKELETON_RESPONSE = {
  name: 'submit_plot_skeleton',
  arguments: {
    title: 'テストの物語',
    theme: '孤独と出会い',
    chapters: [
      {
        index: 1,
        title: '始まり',
        summary: '物語の始まり',
        key_events: ['出会い'],
        target_length: 4000,
      },
      {
        index: 2,
        title: '展開',
        summary: '物語の展開',
        key_events: ['対立'],
        target_length: 4000,
      },
    ],
  },
};

const VALID_CONSTRAINTS_RESPONSE = {
  name: 'submit_chapter_constraints',
  arguments: {
    chapters: [
      {
        index: 1,
        variation_constraints: {
          structure_type: 'single_scene',
          emotional_arc: 'ascending',
          pacing: 'slow_burn',
          deviation_from_previous: null,
          motif_budget: [{ motif: '×マーク', max_uses: 2 }],
        },
        epistemic_constraints: [
          { perspective: '透心', constraints: ['監視されていることを知らない'] },
        ],
      },
      {
        index: 2,
        variation_constraints: {
          structure_type: 'parallel_montage',
          emotional_arc: 'descending',
          pacing: 'rapid_cuts',
          deviation_from_previous: '前章の静的な単一シーンから動的な並列構成へ',
        },
        epistemic_constraints: [
          { perspective: '透心', constraints: ['つるぎの正体を知らない'] },
        ],
      },
    ],
  },
};

function makeToolCallResponse(toolResponse: { name: string; arguments: Record<string, unknown> }, tokenCount: number) {
  return {
    toolCalls: [
      {
        id: 'mock-tool-call-1',
        type: 'function' as const,
        function: {
          name: toolResponse.name,
          arguments: JSON.stringify(toolResponse.arguments),
        },
      },
    ],
    content: null,
    tokensUsed: tokenCount,
  };
}

function createMockPlotterDeps(overrides?: {
  skeletonResponse?: { name: string; arguments: Record<string, unknown> };
  constraintsResponse?: { name: string; arguments: Record<string, unknown> };
  tokenCount?: number;
  config?: Partial<PlotterConfig>;
}): PlotterDeps {
  const tokenCount = overrides?.tokenCount ?? 100;
  const skeletonResp = makeToolCallResponse(
    overrides?.skeletonResponse ?? VALID_SKELETON_RESPONSE,
    tokenCount,
  );
  const constraintsResp = makeToolCallResponse(
    overrides?.constraintsResponse ?? VALID_CONSTRAINTS_RESPONSE,
    tokenCount,
  );

  const completeWithTools = vi.fn()
    .mockResolvedValueOnce(skeletonResp)
    .mockResolvedValueOnce(constraintsResp);

  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue(''),
      completeWithTools,
      getTotalTokens: vi.fn().mockReturnValue(tokenCount),
    },
    soulText: createMockSoulText(),
    config: {
      chapterCount: 2,
      targetTotalLength: 8000,
      temperature: 0.7,
      ...overrides?.config,
    },
  };
}

describe('createPlotter (FP) — 2-phase generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a Plotter with generatePlot method', () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    expect(plotter.generatePlot).toBeInstanceOf(Function);
  });

  it('generatePlot() should call completeWithTools twice (Phase 1 + Phase 2)', async () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    await plotter.generatePlot();
    expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(2);
  });

  it('Phase 1 should use submit_plot_skeleton tool', async () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    await plotter.generatePlot();

    const phase1Call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    const tools = phase1Call[2];
    expect(tools[0].function.name).toBe('submit_plot_skeleton');
    expect(phase1Call[3].toolChoice.function.name).toBe('submit_plot_skeleton');
  });

  it('Phase 2 should use submit_chapter_constraints tool', async () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    await plotter.generatePlot();

    const phase2Call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[1];
    const tools = phase2Call[2];
    expect(tools[0].function.name).toBe('submit_chapter_constraints');
    expect(phase2Call[3].toolChoice.function.name).toBe('submit_chapter_constraints');
  });

  it('generatePlot() should return a merged Plot with skeleton + constraints', async () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    const plot = await plotter.generatePlot();

    expect(plot.title).toBe('テストの物語');
    expect(plot.theme).toBe('孤独と出会い');
    expect(plot.chapters).toHaveLength(2);

    // Chapter 1 has constraints merged
    expect(plot.chapters[0].title).toBe('始まり');
    expect(plot.chapters[0].variation_constraints?.structure_type).toBe('single_scene');
    expect(plot.chapters[0].epistemic_constraints).toHaveLength(1);
    expect(plot.chapters[0].epistemic_constraints![0].perspective).toBe('透心');

    // Chapter 2 has constraints merged
    expect(plot.chapters[1].title).toBe('展開');
    expect(plot.chapters[1].variation_constraints?.structure_type).toBe('parallel_montage');
    expect(plot.chapters[1].variation_constraints?.deviation_from_previous).toBeDefined();
  });

  it('should gracefully handle empty constraints (Phase 2 fallback)', async () => {
    const deps = createMockPlotterDeps({
      constraintsResponse: {
        name: 'submit_chapter_constraints',
        arguments: { chapters: [] },
      },
    });
    const plotter = createPlotter(deps);
    const plot = await plotter.generatePlot();

    // Skeleton still works, constraints are undefined
    expect(plot.chapters).toHaveLength(2);
    expect(plot.chapters[0].variation_constraints).toBeUndefined();
    expect(plot.chapters[0].epistemic_constraints).toBeUndefined();
  });

  it('should pass temperature to both Phase 1 and Phase 2 calls', async () => {
    const deps = createMockPlotterDeps({ config: { temperature: 0.9 } });
    const plotter = createPlotter(deps);
    await plotter.generatePlot();

    const calls = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][3]).toEqual(expect.objectContaining({ temperature: 0.9 }));
    expect(calls[1][3]).toEqual(expect.objectContaining({ temperature: 0.9 }));
  });

  it('should throw on Phase 1 failure (invalid skeleton)', async () => {
    const deps = createMockPlotterDeps({
      skeletonResponse: {
        name: 'submit_plot_skeleton',
        arguments: { title: '', theme: '' },
      },
    });
    const plotter = createPlotter(deps);
    await expect(plotter.generatePlot()).rejects.toThrow();
  });
});
