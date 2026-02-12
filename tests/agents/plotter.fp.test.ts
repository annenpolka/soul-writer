import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlotter } from '../../src/agents/plotter.js';
import type { PlotterDeps, PlotterConfig } from '../../src/agents/types.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { PlotSkeleton } from '../../src/schemas/plot.js';
import type { BatchChapterConstraints } from '../../src/agents/parsers/plotter-parser.js';

const VALID_SKELETON_DATA: PlotSkeleton = {
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
};

const VALID_CONSTRAINTS_DATA: BatchChapterConstraints = {
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
};

function createMockPlotterDeps(overrides?: {
  skeletonData?: PlotSkeleton;
  constraintsData?: BatchChapterConstraints;
  skeletonReasoning?: string | null;
  tokenCount?: number;
  config?: Partial<PlotterConfig>;
}): PlotterDeps {
  const tokenCount = overrides?.tokenCount ?? 100;

  const completeStructured = vi.fn()
    .mockResolvedValueOnce({
      data: overrides?.skeletonData ?? VALID_SKELETON_DATA,
      reasoning: overrides?.skeletonReasoning ?? null,
      tokensUsed: tokenCount,
    })
    .mockResolvedValueOnce({
      data: overrides?.constraintsData ?? VALID_CONSTRAINTS_DATA,
      reasoning: null,
      tokensUsed: tokenCount,
    });

  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue(''),
      completeStructured,
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

  it('generatePlot() should call completeStructured twice (Phase 1 + Phase 2)', async () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    await plotter.generatePlot();
    expect(deps.llmClient.completeStructured).toHaveBeenCalledTimes(2);
  });

  it('Phase 1 should use PlotSkeletonSchema', async () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    await plotter.generatePlot();

    const phase1Call = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls[0];
    // args: [messages, schema, options]
    expect(phase1Call[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({ role: 'user' }),
    ]));
  });

  it('Phase 2 messages should include Phase 1 conversation context (multi-turn)', async () => {
    const deps = createMockPlotterDeps({ skeletonReasoning: 'Phase1のプロット推論' });
    const plotter = createPlotter(deps);
    await plotter.generatePlot();

    const phase2Call = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls[1];
    const phase2Messages = phase2Call[0];

    // Phase 2 messages should contain: system + user (phase1) + assistant (phase1 response) + user (phase2)
    expect(phase2Messages).toHaveLength(4);
    expect(phase2Messages[0].role).toBe('system');
    expect(phase2Messages[1].role).toBe('user');
    expect(phase2Messages[2].role).toBe('assistant');
    expect(phase2Messages[2].content).toContain('テストの物語'); // Phase1 response data
    expect(phase2Messages[2].reasoning).toBe('Phase1のプロット推論');
    expect(phase2Messages[3].role).toBe('user'); // Phase2 context as user message
  });

  it('Phase 2 messages should omit reasoning when Phase 1 has no reasoning', async () => {
    const deps = createMockPlotterDeps({ skeletonReasoning: null });
    const plotter = createPlotter(deps);
    await plotter.generatePlot();

    const phase2Call = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls[1];
    const phase2Messages = phase2Call[0];

    expect(phase2Messages).toHaveLength(4);
    expect(phase2Messages[2].role).toBe('assistant');
    expect(phase2Messages[2].reasoning).toBeUndefined();
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
      constraintsData: { chapters: [] },
    });
    const plotter = createPlotter(deps);
    const plot = await plotter.generatePlot();

    // Skeleton still works, constraints are undefined
    expect(plot.chapters).toHaveLength(2);
    expect(plot.chapters[0].variation_constraints).toBeUndefined();
    expect(plot.chapters[0].epistemic_constraints).toBeUndefined();
  });

  it('should use temperature 1.0 for both Phase 1 and Phase 2 calls', async () => {
    const deps = createMockPlotterDeps({ config: { temperature: 0.9 } });
    const plotter = createPlotter(deps);
    await plotter.generatePlot();

    const calls = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][2]).toEqual(expect.objectContaining({ temperature: 1.0 }));
    expect(calls[1][2]).toEqual(expect.objectContaining({ temperature: 1.0 }));
  });

  it('should preserve variation_axis from skeleton response', async () => {
    const skeletonWithAxis: PlotSkeleton = {
      title: 'テストの物語',
      theme: '孤独と出会い',
      chapters: [
        {
          index: 1,
          title: '始まり',
          summary: '物語の始まり',
          key_events: ['出会い'],
          target_length: 4000,
          variation_axis: {
            curve_type: 'escalation',
            intensity_target: 3,
            differentiation_technique: '内省から外界接触へ',
          },
        },
        {
          index: 2,
          title: '展開',
          summary: '物語の展開',
          key_events: ['対立'],
          target_length: 4000,
          variation_axis: {
            curve_type: 'descent_plateau',
            intensity_target: 4,
            differentiation_technique: '前章の上昇から一転して停滞',
            internal_beats: ['衝撃', '受容', '静寂'],
          },
        },
      ],
    };
    const deps = createMockPlotterDeps({ skeletonData: skeletonWithAxis });
    const plotter = createPlotter(deps);
    const plot = await plotter.generatePlot();

    expect(plot.chapters[0].variation_axis).toBeDefined();
    expect(plot.chapters[0].variation_axis!.curve_type).toBe('escalation');
    expect(plot.chapters[0].variation_axis!.intensity_target).toBe(3);
    expect(plot.chapters[0].variation_axis!.differentiation_technique).toBe('内省から外界接触へ');
    expect(plot.chapters[0].variation_axis!.internal_beats).toBeUndefined();

    expect(plot.chapters[1].variation_axis).toBeDefined();
    expect(plot.chapters[1].variation_axis!.curve_type).toBe('descent_plateau');
    expect(plot.chapters[1].variation_axis!.internal_beats).toEqual(['衝撃', '受容', '静寂']);
  });
});
