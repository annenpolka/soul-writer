import { describe, it, expect } from 'vitest';
import { createPlotMacGuffinAgent, type PlotMacGuffinFn } from '../../src/factory/plot-macguffin.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { GeneratedTheme } from '../../src/schemas/generated-theme.js';

const sampleTheme: GeneratedTheme = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [{ name: '御鐘透心', isNew: false }],
  premise: 'テスト用前提',
  scene_types: ['内面描写'],
  tone: '冷徹',
};

const validPlotMacGuffins = {
  plotMacGuffins: [
    {
      name: '消えたARタグ',
      surfaceAppearance: 'システム障害と片付けられた',
      hiddenLayer: '誰かが意図的に消去した痕跡',
      tensionQuestions: ['誰が消したのか'],
      presenceHint: '物語序盤',
    },
  ],
};

describe('createPlotMacGuffinAgent (FP)', () => {
  it('should return a PlotMacGuffinFn with generate method', () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_plot_macguffins',
      arguments: validPlotMacGuffins,
    });
    const soulText = createMockSoulText();
    const fn: PlotMacGuffinFn = createPlotMacGuffinAgent(llm, soulText);
    expect(typeof fn.generate).toBe('function');
  });

  it('should generate plot macguffins', async () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_plot_macguffins',
      arguments: validPlotMacGuffins,
    });
    const soulText = createMockSoulText();
    const fn = createPlotMacGuffinAgent(llm, soulText);
    const result = await fn.generate(sampleTheme);
    expect(result.macguffins).toHaveLength(1);
    expect(result.macguffins[0].name).toBe('消えたARタグ');
    expect(llm.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('should accept optional charMacGuffins', async () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_plot_macguffins',
      arguments: validPlotMacGuffins,
    });
    const soulText = createMockSoulText();
    const fn = createPlotMacGuffinAgent(llm, soulText);
    const charMacGuffins = [{
      characterName: '御鐘透心',
      secret: '秘密',
      surfaceSigns: ['兆候'],
      narrativeFunction: '機能',
    }];
    const result = await fn.generate(sampleTheme, charMacGuffins);
    expect(result.macguffins).toHaveLength(1);
  });

  it('should fallback on parse failure', async () => {
    const llm = createMockLLMClientWithTools({
      name: 'wrong_tool',
      arguments: {},
    });
    const soulText = createMockSoulText();
    const fn = createPlotMacGuffinAgent(llm, soulText);
    const result = await fn.generate(sampleTheme);
    // Fallback returns one default plot macguffin
    expect(result.macguffins).toHaveLength(1);
    expect(result.macguffins[0].name).toBe('説明のつかない現象');
  });
});
