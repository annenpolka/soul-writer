import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlotterAgent } from '../../src/agents/plotter.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';
import { DEFAULT_PLOTTER_CONFIG } from '../../src/agents/types.js';
import type { GeneratedTheme } from '../../src/schemas/generated-theme.js';

// Mock LLM Client
const createMockLLMClient = (response: string): LLMClient => ({
  complete: vi.fn().mockResolvedValue(response),
  getTotalTokens: vi.fn().mockReturnValue(100),
});

// Mock Soul Text
const mockSoulText: SoulText = {
  constitution: {
    meta: {
      soul_id: 'test',
      soul_name: 'Test Soul',
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
      forbidden_words: ['とても'],
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
    technology: {},
    society: {},
    characters: {
      透心: { role: 'protagonist', description: '孤児の学級委員長' },
      つるぎ: { role: 'deuteragonist', description: 'ハッカー' },
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
  promptConfig: { defaults: { protagonist_short: '', pronoun: '' } },

  fragments: new Map(),
};

// Valid plot JSON response
const validPlotResponse = JSON.stringify({
  title: '透心の朝',
  theme: '存在確認と無関心な世界での孤独',
  chapters: [
    {
      index: 1,
      title: '目覚め',
      summary: '透心が朝を迎える',
      key_events: ['起床', 'MRタグの確認'],
      target_length: 4000,
    },
    {
      index: 2,
      title: '教室',
      summary: '学校での日常',
      key_events: ['クラスメイトとの会話', '孤独感'],
      target_length: 4000,
    },
  ],
});

describe('PlotterAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a plotter agent with default config', () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);
      expect(plotter).toBeInstanceOf(PlotterAgent);
    });

    it('should merge custom config with defaults', () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const customConfig = { chapterCount: 3 };
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText, customConfig);
      const config = plotter.getConfig();

      expect(config.chapterCount).toBe(3);
      expect(config.targetTotalLength).toBe(DEFAULT_PLOTTER_CONFIG.targetTotalLength);
    });
  });

  describe('generatePlot', () => {
    it('should generate a valid plot structure', async () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);
      const result = await plotter.generatePlot();

      expect(result.plot).toBeDefined();
      expect(result.plot.title).toBe('透心の朝');
      expect(result.plot.theme).toBeDefined();
      expect(result.plot.chapters).toHaveLength(2);
    });

    it('should track token usage', async () => {
      let tokenCount = 50;
      const mockLLMClient: LLMClient = {
        complete: vi.fn().mockResolvedValue(validPlotResponse),
        getTotalTokens: vi.fn().mockImplementation(() => {
          tokenCount += 50;
          return tokenCount;
        }),
      };

      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);
      const result = await plotter.generatePlot();

      expect(result.tokensUsed).toBe(50);
    });

    it('should include soul text themes in system prompt', async () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);
      await plotter.generatePlot();

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(systemPrompt).toContain('プロット設計者');
      expect(systemPrompt).toContain('存在確認');
    });

    it('should include characters in system prompt', async () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);
      await plotter.generatePlot();

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(systemPrompt).toContain('透心');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', async () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);
      const result = await plotter.generatePlot();

      expect(result.plot.title).toBe('透心の朝');
      expect(result.plot.chapters[0].index).toBe(1);
    });

    it('should extract JSON from markdown code block', async () => {
      const responseWithCodeBlock = `
Here is the plot structure:

\`\`\`json
${validPlotResponse}
\`\`\`

This plot focuses on the theme of existence.
`;
      const mockLLMClient = createMockLLMClient(responseWithCodeBlock);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);
      const result = await plotter.generatePlot();

      expect(result.plot.title).toBe('透心の朝');
    });

    it('should throw on invalid JSON', async () => {
      const mockLLMClient = createMockLLMClient('This is not JSON');
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);

      await expect(plotter.generatePlot()).rejects.toThrow();
    });

    it('should throw on schema validation failure', async () => {
      const invalidPlot = JSON.stringify({
        title: '', // invalid: empty
        theme: 'test',
        chapters: [],
      });
      const mockLLMClient = createMockLLMClient(invalidPlot);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);

      await expect(plotter.generatePlot()).rejects.toThrow();
    });
  });

  describe('with theme', () => {
    const mockTheme: GeneratedTheme = {
      emotion: '孤独',
      timeline: '出会い前',
      characters: [
        { name: '御鐘透心', isNew: false },
        { name: '新キャラ', isNew: true, description: 'テスト用の新キャラクター' },
      ],
      premise: 'テスト前提文',
    };

    it('should include theme in user prompt', async () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText, {
        chapterCount: 3,
        theme: mockTheme,
      });

      await plotter.generatePlot();

      const userPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userPrompt).toContain('感情テーマ: 孤独');
      expect(userPrompt).toContain('時系列: 出会い前');
      expect(userPrompt).toContain('テスト前提文');
    });

    it('should include new character with description', async () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText, {
        chapterCount: 3,
        theme: mockTheme,
      });

      await plotter.generatePlot();

      const userPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userPrompt).toContain('新キャラ（新規）');
      expect(userPrompt).toContain('テスト用の新キャラクター');
    });

    it('should include existing character without description', async () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText, {
        chapterCount: 3,
        theme: mockTheme,
      });

      await plotter.generatePlot();

      const userPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userPrompt).toContain('- 御鐘透心');
      expect(userPrompt).not.toContain('御鐘透心（新規）');
    });

    it('should work without theme (backward compatible)', async () => {
      const mockLLMClient = createMockLLMClient(validPlotResponse);
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText, { chapterCount: 3 });

      const result = await plotter.generatePlot();

      expect(result.plot).toBeDefined();
      expect(result.plot.title).toBe('透心の朝');
    });
  });
});
