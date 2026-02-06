import { describe, it, expect } from 'vitest';
import { createCharacterMacGuffinAgent, type CharacterMacGuffinFn } from '../../src/factory/character-macguffin.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { GeneratedTheme } from '../../src/schemas/generated-theme.js';

const sampleTheme: GeneratedTheme = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [
    { name: '御鐘透心', isNew: false, description: '孤児の学級委員長' },
    { name: '愛原つるぎ', isNew: false, description: 'ハッカー' },
  ],
  premise: 'テスト用前提',
  scene_types: ['内面描写'],
  tone: '冷徹',
};

const validMacGuffins = {
  characterMacGuffins: [
    {
      characterName: '御鐘透心',
      secret: '過去に誰かを本当に殺した記憶がある',
      surfaceSigns: ['時折見せる不自然な笑顔'],
      narrativeFunction: '主人公の内面的葛藤を深める',
    },
  ],
};

describe('createCharacterMacGuffinAgent (FP)', () => {
  it('should return a CharacterMacGuffinFn with generate method', () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_character_macguffins',
      arguments: validMacGuffins,
    });
    const soulText = createMockSoulText();
    const fn: CharacterMacGuffinFn = createCharacterMacGuffinAgent(llm, soulText);
    expect(typeof fn.generate).toBe('function');
  });

  it('should generate character macguffins', async () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_character_macguffins',
      arguments: validMacGuffins,
    });
    const soulText = createMockSoulText();
    const fn = createCharacterMacGuffinAgent(llm, soulText);
    const result = await fn.generate(sampleTheme);
    expect(result.macguffins).toHaveLength(1);
    expect(result.macguffins[0].characterName).toBe('御鐘透心');
    expect(llm.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('should fallback on parse failure', async () => {
    const llm = createMockLLMClientWithTools({
      name: 'wrong_tool',
      arguments: {},
    });
    const soulText = createMockSoulText();
    const fn = createCharacterMacGuffinAgent(llm, soulText);
    const result = await fn.generate(sampleTheme);
    // Fallback generates one macguffin per theme character
    expect(result.macguffins).toHaveLength(2);
    expect(result.macguffins[0].characterName).toBe('御鐘透心');
  });
});
