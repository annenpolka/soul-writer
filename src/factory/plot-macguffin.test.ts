import { describe, it, expect, vi } from 'vitest';
import { PlotMacGuffinAgent } from './plot-macguffin.js';
import type { LLMClient } from '../llm/types.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { createMockSoulText } from '../../tests/helpers/mock-soul-text.js';

const mockSoulText = createMockSoulText();

const baseTheme: GeneratedTheme = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [
    { name: '御鐘透心', isNew: false },
  ],
  premise: 'テスト前提',
  scene_types: ['教室'],
};

describe('PlotMacGuffinAgent', () => {
  it('should use tool calling for plot macguffins', async () => {
    const toolArgs = {
      plotMacGuffins: [
        {
          name: '不可解なログ',
          surfaceAppearance: '日常のノイズとして扱われる',
          hiddenLayer: '誰かの介入の痕跡',
          tensionQuestions: ['誰が何の目的で？'],
          presenceHint: '第一章の終盤',
        },
      ],
    };
    const llm: LLMClient = {
      complete: vi.fn().mockResolvedValue('ignored text'),
      completeWithTools: vi.fn().mockResolvedValue({
        toolCalls: [{
          id: 'tc-1',
          type: 'function',
          function: {
            name: 'submit_plot_macguffins',
            arguments: JSON.stringify(toolArgs),
          },
        }],
        content: null,
        tokensUsed: 50,
      }),
      getTotalTokens: vi.fn().mockReturnValue(100),
    };

    const agent = new PlotMacGuffinAgent(llm, mockSoulText);
    const result = await agent.generate(baseTheme);

    expect(llm.completeWithTools).toHaveBeenCalledTimes(1);
    expect(result.macguffins[0].name).toBe('不可解なログ');
  });
});
