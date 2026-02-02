import { describe, it, expect, vi } from 'vitest';
import { CharacterMacGuffinAgent } from './character-macguffin.js';
import type { LLMClient } from '../llm/types.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { createMockSoulText } from '../../tests/helpers/mock-soul-text.js';

const mockSoulText = createMockSoulText({
  characters: {
    御鐘透心: { role: 'protagonist', description: '孤児の学級委員長' },
    愛原つるぎ: { role: 'deuteragonist', description: 'ハッカー' },
  },
});

const baseTheme: GeneratedTheme = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [
    { name: '御鐘透心', isNew: false },
    { name: '愛原つるぎ', isNew: false },
  ],
  premise: 'テスト前提',
  scene_types: ['教室'],
};

describe('CharacterMacGuffinAgent', () => {
  it('should use tool calling for character macguffins', async () => {
    const toolArgs = {
      characterMacGuffins: [
        {
          characterName: '御鐘透心',
          secret: 'ツール経由の秘密',
          surfaceSigns: ['視線が定まらない'],
          narrativeFunction: '不安の核',
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
            name: 'submit_character_macguffins',
            arguments: JSON.stringify(toolArgs),
          },
        }],
        content: null,
        tokensUsed: 50,
      }),
      getTotalTokens: vi.fn().mockReturnValue(100),
    };

    const agent = new CharacterMacGuffinAgent(llm, mockSoulText);
    const result = await agent.generate(baseTheme);

    expect(llm.completeWithTools).toHaveBeenCalledTimes(1);
    expect(result.macguffins[0].secret).toBe('ツール経由の秘密');
  });
});
