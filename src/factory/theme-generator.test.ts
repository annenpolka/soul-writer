import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeGeneratorAgent } from './theme-generator.js';
import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { createMockSoulText } from '../../tests/helpers/mock-soul-text.js';

// Mock LLM Client - supports two-stage generation (stage 1: complete, stage 2: tool call)
const createMockLLMClient = (response: string): LLMClient => ({
  complete: vi.fn()
    .mockResolvedValueOnce('A wild creative idea about loneliness in a digital world'),  // Stage 1
  completeWithTools: vi.fn().mockResolvedValue({
    toolCalls: [{
      id: 'tc-1',
      type: 'function',
      function: {
        name: 'submit_theme',
        arguments: response,
      },
    }],
    content: null,
    tokensUsed: 50,
  }),
  getTotalTokens: vi.fn().mockReturnValue(100),
});

const mockSoulText = createMockSoulText({
  thematicMustPreserve: ['存在確認', '無関心な世界'],
  characters: {
    御鐘透心: { role: 'protagonist', description: '孤児の学級委員長' },
    愛原つるぎ: { role: 'deuteragonist', description: 'ハッカー' },
  },
  deep: {
    worldBible: {
      technology: {
        ar_contact: { description: 'ARコンタクト' },
      },
      society: {
        interpersonal: { state: '無関心', implications: [] },
      },
    },
  } as never,
});

// Valid theme JSON response
const validThemeResponse = JSON.stringify({
  emotion: '孤独',
  timeline: '出会い前',
  characters: [
    { name: '御鐘透心', isNew: false },
    { name: '愛原つるぎ', isNew: false },
  ],
  premise: '透心が日常の中で感じる空虚さを描く物語',
  scene_types: ['教室独白', '日常観察'],
});

const themeWithNewCharacter = JSON.stringify({
  emotion: '渇望',
  timeline: '出会い後',
  characters: [
    { name: '御鐘透心', isNew: false },
    { name: '新入生A', isNew: true, description: '透心のクラスに転入してきた謎の生徒' },
  ],
  premise: '新入生との出会いが透心に変化をもたらす',
  scene_types: ['MRフロアセッション', '通学路・移動'],
});

describe('ThemeGeneratorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a theme generator agent', () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);
      expect(generator).toBeInstanceOf(ThemeGeneratorAgent);
    });
  });

  describe('generateTheme', () => {
    it('should generate a valid theme', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      const result = await generator.generateTheme();

      expect(result.theme).toBeDefined();
      expect(result.theme.emotion).toBe('孤独');
      expect(result.theme.timeline).toBe('出会い前');
      expect(result.theme.premise).toBe('透心が日常の中で感じる空虚さを描く物語');
    });

    it('should use two-stage generation (wild idea + refine)', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await generator.generateTheme();

      // Should call LLM twice: stage 1 (wild idea) and stage 2 (tool call)
      expect(mockLLM.complete).toHaveBeenCalledTimes(1);
      expect(mockLLM.completeWithTools).toHaveBeenCalledTimes(1);
    });

    it('should use tool calling for stage 2 refinement', async () => {
      const toolTheme = {
        emotion: '孤独',
        timeline: '出会い前',
        characters: [
          { name: '御鐘透心', isNew: false },
          { name: '愛原つるぎ', isNew: false },
        ],
        premise: '透心が日常の中で感じる空虚さを描く物語',
        scene_types: ['教室独白', '日常観察'],
      };
      const mockLLM: LLMClient = {
        complete: vi.fn()
          .mockResolvedValueOnce('Wild idea for tool call')
          .mockResolvedValueOnce('NOT JSON'),
        completeWithTools: vi.fn().mockResolvedValue({
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: {
              name: 'submit_theme',
              arguments: JSON.stringify(toolTheme),
            },
          }],
          content: null,
          tokensUsed: 50,
        }),
        getTotalTokens: vi.fn().mockReturnValue(100),
      };
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      const result = await generator.generateTheme();

      expect(mockLLM.completeWithTools).toHaveBeenCalledTimes(1);
      expect(result.theme.emotion).toBe('孤独');
    });

    it('should include characters in stage 2 system prompt', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await generator.generateTheme();

      // Stage 2 (second call) uses full system prompt with world bible
      const stage2SystemPrompt = (mockLLM.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(stage2SystemPrompt).toContain('御鐘透心');
      expect(stage2SystemPrompt).toContain('愛原つるぎ');
    });

    it('should include thematic constraints in stage 2 prompt', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await generator.generateTheme();

      const stage2SystemPrompt = (mockLLM.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(stage2SystemPrompt).toContain('存在確認');
      expect(stage2SystemPrompt).toContain('無関心な世界');
    });

    it('should include ideation strategy in stage 1 prompt', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await generator.generateTheme();

      // Stage 1 (first call) should have creative instructions
      const stage1SystemPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(stage1SystemPrompt).toContain('発想法');
    });

    it('should include wild idea in stage 2 user prompt', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await generator.generateTheme();

      // Stage 2 user prompt should contain the wild idea from stage 1
      const stage2UserPrompt = (mockLLM.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(stage2UserPrompt).toContain('A wild creative idea about loneliness in a digital world');
    });

    it('should include recent themes for history avoidance', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      const recentThemes = [{
        emotion: '孤独',
        timeline: '出会い前',
        characters: [{ name: '透心', isNew: false }],
        premise: '既出の前提文',
        scene_types: ['教室独白'],
      }];

      await generator.generateTheme(recentThemes);

      const stage2UserPrompt = (mockLLM.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(stage2UserPrompt).toContain('既出テーマ');
      expect(stage2UserPrompt).toContain('孤独');
      expect(stage2UserPrompt).toContain('既出の前提文');
    });

    it('should track token usage across both stages', async () => {
      let tokenCount = 0;
      const mockLLM: LLMClient = {
        complete: vi.fn()
          .mockResolvedValueOnce('Wild idea text'),  // Stage 1
        completeWithTools: vi.fn().mockResolvedValue({
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: {
              name: 'submit_theme',
              arguments: validThemeResponse,
            },
          }],
          content: null,
          tokensUsed: 50,
        }),
        getTotalTokens: vi.fn().mockImplementation(() => {
          tokenCount += 50;
          return tokenCount;
        }),
      };

      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);
      const result = await generator.generateTheme();

      // Two LLM calls (wild idea + refine), getTotalTokens called before and after
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(mockLLM.complete).toHaveBeenCalledTimes(1);
      expect(mockLLM.completeWithTools).toHaveBeenCalledTimes(1);
    });

    it('should handle new character with description', async () => {
      const mockLLM: LLMClient = {
        complete: vi.fn()
          .mockResolvedValueOnce('Wild idea about a newcomer'),
        completeWithTools: vi.fn().mockResolvedValue({
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: {
              name: 'submit_theme',
              arguments: themeWithNewCharacter,
            },
          }],
          content: null,
          tokensUsed: 50,
        }),
        getTotalTokens: vi.fn().mockReturnValue(100),
      };
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      const result = await generator.generateTheme();

      expect(result.theme.characters).toHaveLength(2);
      const newChar = result.theme.characters.find((c) => c.isNew);
      expect(newChar).toBeDefined();
      expect(newChar?.name).toBe('新入生A');
      expect(newChar?.description).toBe('透心のクラスに転入してきた謎の生徒');
    });

    it('should throw on invalid JSON response', async () => {
      const mockLLM: LLMClient = {
        complete: vi.fn()
          .mockResolvedValueOnce('Wild idea'),
        completeWithTools: vi.fn().mockResolvedValue({
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: {
              name: 'submit_theme',
              arguments: 'This is not JSON',
            },
          }],
          content: null,
          tokensUsed: 50,
        }),
        getTotalTokens: vi.fn().mockReturnValue(100),
      };
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await expect(generator.generateTheme()).rejects.toThrow();
    });

    it('should use world_description from promptConfig in stage 1', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          agents: {
            theme_generator: {
              world_description: 'カスタム世界観の説明文',
            },
          },
        },
      };
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, soulTextWithConfig);
      await generator.generateTheme();

      const stage1SystemPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(stage1SystemPrompt).toContain('カスタム世界観の説明文');
    });

    it('should use scene_catalog from promptConfig in stage 2', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          scene_catalog: ['カスタムシーン1', 'カスタムシーン2'],
        },
      };
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, soulTextWithConfig);
      await generator.generateTheme();

      const stage2SystemPrompt = (mockLLM.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(stage2SystemPrompt).toContain('カスタムシーン1');
      expect(stage2SystemPrompt).toContain('カスタムシーン2');
    });

    it('should use timeline_catalog from promptConfig in stage 1', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          timeline_catalog: ['カスタムタイムライン1', 'カスタムタイムライン2'],
        },
      };
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, soulTextWithConfig);
      // Run multiple times to ensure at least one custom timeline appears
      // Since pickRandom selects from the catalog, with only 2 items one must appear
      await generator.generateTheme();

      const stage1UserPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      const hasCustomTimeline = stage1UserPrompt.includes('カスタムタイムライン1') || stage1UserPrompt.includes('カスタムタイムライン2');
      expect(hasCustomTimeline).toBe(true);
    });

    it('should use ideation_strategies from promptConfig in stage 1', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          ideation_strategies: ['カスタム発想法のみ'],
        },
      };
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, soulTextWithConfig);
      await generator.generateTheme();

      const stage1SystemPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(stage1SystemPrompt).toContain('カスタム発想法のみ');
    });

    it('should throw on invalid theme structure', async () => {
      const invalidTheme = JSON.stringify({
        emotion: '',  // invalid: empty
        timeline: '出会い前',
        characters: [],  // invalid: empty
        premise: 'test',
      });
      const mockLLM: LLMClient = {
        complete: vi.fn()
          .mockResolvedValueOnce('Wild idea'),
        completeWithTools: vi.fn().mockResolvedValue({
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: {
              name: 'submit_theme',
              arguments: invalidTheme,
            },
          }],
          content: null,
          tokensUsed: 50,
        }),
        getTotalTokens: vi.fn().mockReturnValue(100),
      };
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await expect(generator.generateTheme()).rejects.toThrow();
    });

    it('should include 5 tone axis labels in stage 1 system prompt', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);
      await generator.generateTheme();

      const stage1SystemPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(stage1SystemPrompt).toContain('【感情距離】');
      expect(stage1SystemPrompt).toContain('【構造制約】');
      expect(stage1SystemPrompt).toContain('【美学方向】');
      expect(stage1SystemPrompt).toContain('【テンポ】');
      expect(stage1SystemPrompt).toContain('【視点操作】');
    });

    it('should include tone axes in stage 2 system prompt', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);
      await generator.generateTheme();

      const stage2SystemPrompt = (mockLLM.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(stage2SystemPrompt).toContain('【感情距離】');
      expect(stage2SystemPrompt).toContain('【視点操作】');
    });

    it('should use tone_axes override from promptConfig', async () => {
      const soulTextWithAxes: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          tone_axes: {
            aesthetic_direction: ['カスタム美学のみ'],
          },
        },
      };
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, soulTextWithAxes);
      await generator.generateTheme();

      const stage1SystemPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(stage1SystemPrompt).toContain('カスタム美学のみ');
    });

    it('should map old tone_directives to aesthetic_direction for backward compat', async () => {
      const soulTextWithOldFormat: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          tone_directives: ['旧フォーマットのディレクティブ'],
        },
      };
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, soulTextWithOldFormat);
      await generator.generateTheme();

      const stage1SystemPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(stage1SystemPrompt).toContain('旧フォーマットのディレクティブ');
    });
  });
});
