import { describe, it, expect, vi } from 'vitest';
import { createCharacterDeveloper, type CharacterDeveloperFn } from '../../src/factory/character-developer.js';
import { createMockLLMClientWithStructured } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { GeneratedTheme } from '../../src/schemas/generated-theme.js';

const sampleTheme: GeneratedTheme = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [
    { name: '御鐘透心', isNew: false, description: '孤児の学級委員長' },
  ],
  premise: 'テスト用前提',
  scene_types: ['内面描写'],
  tone: '冷徹',
};

const validCharacters = {
  characters: [
    {
      name: '御鐘透心',
      isNew: false,
      role: '主人公',
      description: '孤児の学級委員長',
      voice: '冷徹な独白',
    },
  ],
  castingRationale: 'テスト用キャスティング理由',
};

describe('createCharacterDeveloper (FP)', () => {
  it('should return a CharacterDeveloperFn with develop method', () => {
    const llm = createMockLLMClientWithStructured(validCharacters);
    const soulText = createMockSoulText();
    const fn: CharacterDeveloperFn = createCharacterDeveloper(llm, soulText);
    expect(typeof fn.develop).toBe('function');
  });

  it('should develop characters from theme', async () => {
    const llm = createMockLLMClientWithStructured(validCharacters);
    const soulText = createMockSoulText();
    const fn = createCharacterDeveloper(llm, soulText);
    const result = await fn.develop(sampleTheme);
    expect(result.developed.characters).toHaveLength(1);
    expect(result.developed.characters[0].name).toBe('御鐘透心');
    expect(result.developed.castingRationale).toBe('テスト用キャスティング理由');
    expect(llm.completeStructured).toHaveBeenCalledTimes(1);
  });

  it('should accept optional charMacGuffins', async () => {
    const llm = createMockLLMClientWithStructured(validCharacters);
    const soulText = createMockSoulText();
    const fn = createCharacterDeveloper(llm, soulText);
    const charMacGuffins = [{
      characterName: '御鐘透心',
      secret: '秘密',
      surfaceSigns: ['兆候'],
      narrativeFunction: '機能',
    }];
    const result = await fn.develop(sampleTheme, charMacGuffins);
    expect(result.developed.characters).toHaveLength(1);
  });

  it('should fallback on completeStructured failure', async () => {
    const llm = createMockLLMClientWithStructured(validCharacters);
    (llm.completeStructured as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const soulText = createMockSoulText();
    const fn = createCharacterDeveloper(llm, soulText);
    const result = await fn.develop(sampleTheme);
    expect(result.developed.characters).toHaveLength(1);
    expect(result.developed.castingRationale).toContain('Fallback');
  });
});
