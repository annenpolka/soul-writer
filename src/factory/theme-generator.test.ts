import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeGeneratorAgent, type ThemeResult } from './theme-generator.js';
import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';

// Mock LLM Client
const createMockLLMClient = (response: string): LLMClient => ({
  complete: vi.fn().mockResolvedValue(response),
  getTotalTokens: vi.fn().mockReturnValue(100),
});

// Minimal mock SoulText
const mockSoulText: SoulText = {
  constitution: {
    meta: {
      soul_id: 'test',
      soul_name: 'わたしのライオン',
      version: '1.0.0',
      created_at: '',
      updated_at: '',
    },
    sentence_structure: {
      rhythm_pattern: 'test',
      taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
      typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
    },
    vocabulary: {
      bracket_notations: [],
      forbidden_words: [],
      characteristic_expressions: [],
      special_marks: { mark: '×', usage: 'test', forms: [] },
    },
    rhetoric: {
      simile_base: 'test',
      metaphor_density: 'low',
      forbidden_similes: [],
      personification_allowed_for: [],
    },
    narrative: {
      default_pov: 'test',
      pov_by_character: {},
      default_tense: 'test',
      tense_shift_allowed: 'test',
      dialogue_ratio: 'test',
      dialogue_style_by_character: {},
    },
    thematic_constraints: {
      must_preserve: ['存在確認', '無関心な世界'],
      forbidden_resolutions: [],
    },
  },
  worldBible: {
    technology: {
      ar_contact: { description: 'ARコンタクト' },
    },
    society: {
      interpersonal: { state: '無関心', implications: [] },
    },
    characters: {
      御鐘透心: { role: 'protagonist', description: '孤児の学級委員長' },
      愛原つるぎ: { role: 'deuteragonist', description: 'ハッカー' },
    },
    terminology: {},
    locations: {},
  },
  antiSoul: {
    categories: {
      excessive_sentiment: [],
      explanatory_worldbuilding: [],
      character_normalization: [],
      cliche_simile: [],
      theme_violation: [],
      mentor_tsurgi: [],
      lion_concretization: [],
    },
  },
  readerPersonas: { personas: [] },
  fragments: new Map(),
};

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

    it('should include characters from world bible in prompt', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await generator.generateTheme();

      const systemPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(systemPrompt).toContain('御鐘透心');
      expect(systemPrompt).toContain('愛原つるぎ');
    });

    it('should include thematic constraints in prompt', async () => {
      const mockLLM = createMockLLMClient(validThemeResponse);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await generator.generateTheme();

      const systemPrompt = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(systemPrompt).toContain('存在確認');
      expect(systemPrompt).toContain('無関心な世界');
    });

    it('should track token usage', async () => {
      let tokenCount = 50;
      const mockLLM: LLMClient = {
        complete: vi.fn().mockResolvedValue(validThemeResponse),
        getTotalTokens: vi.fn().mockImplementation(() => {
          tokenCount += 50;
          return tokenCount;
        }),
      };

      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);
      const result = await generator.generateTheme();

      expect(result.tokensUsed).toBe(50);
    });

    it('should handle new character with description', async () => {
      const mockLLM = createMockLLMClient(themeWithNewCharacter);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      const result = await generator.generateTheme();

      expect(result.theme.characters).toHaveLength(2);
      const newChar = result.theme.characters.find((c) => c.isNew);
      expect(newChar).toBeDefined();
      expect(newChar?.name).toBe('新入生A');
      expect(newChar?.description).toBe('透心のクラスに転入してきた謎の生徒');
    });

    it('should throw on invalid JSON response', async () => {
      const mockLLM = createMockLLMClient('This is not JSON');
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await expect(generator.generateTheme()).rejects.toThrow();
    });

    it('should throw on invalid theme structure', async () => {
      const invalidTheme = JSON.stringify({
        emotion: '',  // invalid: empty
        timeline: '出会い前',
        characters: [],  // invalid: empty
        premise: 'test',
      });
      const mockLLM = createMockLLMClient(invalidTheme);
      const generator = new ThemeGeneratorAgent(mockLLM, mockSoulText);

      await expect(generator.generateTheme()).rejects.toThrow();
    });
  });
});
