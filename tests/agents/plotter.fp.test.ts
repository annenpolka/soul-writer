import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlotter } from '../../src/agents/plotter.js';
import type { PlotterDeps, PlotterConfig } from '../../src/agents/types.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

const VALID_PLOT_RESPONSE = {
  name: 'submit_plot',
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

function createMockPlotterDeps(overrides?: {
  toolResponse?: { name: string; arguments: Record<string, unknown> };
  tokenCount?: number;
  config?: Partial<PlotterConfig>;
}): PlotterDeps {
  const tokenCount = overrides?.tokenCount ?? 100;
  let callCount = 0;
  const llmClient = createMockLLMClientWithTools(
    overrides?.toolResponse ?? VALID_PLOT_RESPONSE,
    tokenCount,
  );
  // Make getTotalTokens return increasing values for token calculation
  (llmClient.getTotalTokens as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount++;
    return callCount === 1 ? 0 : tokenCount;
  });

  return {
    llmClient,
    soulText: createMockSoulText(),
    config: {
      chapterCount: 2,
      targetTotalLength: 8000,
      temperature: 0.7,
      ...overrides?.config,
    },
  };
}

describe('createPlotter (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a Plotter with generatePlot method', () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    expect(plotter.generatePlot).toBeInstanceOf(Function);
  });

  it('generatePlot() should call completeWithTools', async () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    await plotter.generatePlot();
    expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('generatePlot() should return a valid Plot', async () => {
    const deps = createMockPlotterDeps();
    const plotter = createPlotter(deps);
    const plot = await plotter.generatePlot();
    expect(plot.title).toBe('テストの物語');
    expect(plot.theme).toBe('孤独と出会い');
    expect(plot.chapters).toHaveLength(2);
    expect(plot.chapters[0].title).toBe('始まり');
  });

  it('generatePlot() should pass temperature to LLM', async () => {
    const deps = createMockPlotterDeps({ config: { temperature: 0.9 } });
    const plotter = createPlotter(deps);
    await plotter.generatePlot();
    const callArgs = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[3]).toEqual(expect.objectContaining({
      temperature: 0.9,
    }));
  });

  it('generatePlot() should throw on invalid plot structure', async () => {
    const deps = createMockPlotterDeps({
      toolResponse: {
        name: 'submit_plot',
        arguments: {
          title: 'bad',
          // missing required fields
        },
      },
    });
    const plotter = createPlotter(deps);
    await expect(plotter.generatePlot()).rejects.toThrow();
  });
});
