import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterDeveloperAgent } from './character-developer.js';
import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';

const mockLLMClient: LLMClient = {
  complete: vi.fn(),
  getTotalTokens: vi.fn().mockReturnValue(0),
};

const mockSoulText = {
  worldBible: {
    characters: {
      '御鐘透心': { role: '学級委員長、主人公', voice: '短い文、防御的' },
      '愛原つるぎ': { role: 'ハッカー', voice: '饒舌、挑発的' },
      '叔父': { role: '技術者、MRフロア所有者' },
    },
    terminology: {},
    technology: {},
    society: {},
    locations: {},
  },
  constitution: { meta: { soul_name: 'test' } },
  fragments: new Map(),
  antiSoul: { categories: {} },
} as unknown as SoulText;

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

describe('CharacterDeveloperAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockLLMClient.getTotalTokens as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100);
  });

  it('parses valid JSON response with developed characters', async () => {
    const response = JSON.stringify({
      characters: [
        { name: '御鐘透心', isNew: false, role: '観察者', voice: '冷徹な独白' },
        { name: '新キャラ', isNew: true, role: '転校生', description: '無口な少年', voice: '単語のみ' },
      ],
      castingRationale: 'テーマに合わせた構成',
    });
    (mockLLMClient.complete as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const agent = new CharacterDeveloperAgent(mockLLMClient, mockSoulText);
    const result = await agent.develop(baseTheme);

    expect(result.developed.characters).toHaveLength(2);
    expect(result.developed.characters[0].name).toBe('御鐘透心');
    expect(result.developed.characters[1].isNew).toBe(true);
    expect(result.developed.castingRationale).toBe('テーマに合わせた構成');
    expect(result.tokensUsed).toBe(100);
  });

  it('falls back to theme characters on invalid JSON', async () => {
    (mockLLMClient.complete as ReturnType<typeof vi.fn>).mockResolvedValue('invalid response');

    const agent = new CharacterDeveloperAgent(mockLLMClient, mockSoulText);
    const result = await agent.develop(baseTheme);

    expect(result.developed.characters).toHaveLength(2);
    expect(result.developed.castingRationale).toContain('Fallback');
  });

  it('falls back on empty characters array', async () => {
    const response = JSON.stringify({ characters: [], castingRationale: '' });
    (mockLLMClient.complete as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const agent = new CharacterDeveloperAgent(mockLLMClient, mockSoulText);
    const result = await agent.develop(baseTheme);

    expect(result.developed.characters).toHaveLength(2); // fallback to theme
  });

  it('includes narrative_type in user prompt when present', async () => {
    const themeWithNarrative: GeneratedTheme = {
      ...baseTheme,
      narrative_type: '群像劇',
    };
    const response = JSON.stringify({
      characters: [{ name: 'テスト', isNew: true, role: 'test' }],
      castingRationale: 'test',
    });
    (mockLLMClient.complete as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const agent = new CharacterDeveloperAgent(mockLLMClient, mockSoulText);
    await agent.develop(themeWithNarrative);

    const userPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(userPrompt).toContain('群像劇');
  });

  it('system prompt mentions uncle constraint', async () => {
    const response = JSON.stringify({
      characters: [{ name: 'テスト', isNew: true, role: 'test' }],
      castingRationale: 'test',
    });
    (mockLLMClient.complete as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const agent = new CharacterDeveloperAgent(mockLLMClient, mockSoulText);
    await agent.develop(baseTheme);

    const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(systemPrompt).toContain('叔父');
    expect(systemPrompt).toContain('不可欠な場合');
  });
});
