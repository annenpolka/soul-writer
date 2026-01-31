import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReaderJuryAgent } from '../../src/agents/reader-jury.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { ReaderPersona } from '../../src/schemas/reader-personas.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

// Mock LLM Client
const createMockLLMClient = (): LLMClient => ({
  complete: vi.fn().mockImplementation(async () => {
    return JSON.stringify({
      categoryScores: {
        style: 0.8,
        plot: 0.75,
        character: 0.7,
        worldbuilding: 0.85,
        readability: 0.8,
      },
      feedback: '良い評価です。',
    });
  }),
  getTotalTokens: vi.fn().mockReturnValue(100),
});

// Mock personas
const mockPersonas: ReaderPersona[] = [
  {
    id: 'sf_fan',
    name: 'SF愛好家',
    description: 'SFの技術的整合性を重視する読者',
    preferences: ['世界設定の緻密さ'],
    evaluation_weights: {
      style: 0.2,
      plot: 0.2,
      character: 0.2,
      worldbuilding: 0.3,
      readability: 0.1,
    },
  },
  {
    id: 'literary_girl',
    name: '文学少女',
    description: '文体の美しさを重視する読者',
    preferences: ['文体の美しさ', '心理描写'],
    evaluation_weights: {
      style: 0.35,
      plot: 0.15,
      character: 0.3,
      worldbuilding: 0.1,
      readability: 0.1,
    },
  },
  {
    id: 'light_reader',
    name: 'ライトリーダー',
    description: 'テンポを重視する読者',
    preferences: ['テンポ', '読みやすさ'],
    evaluation_weights: {
      style: 0.1,
      plot: 0.3,
      character: 0.2,
      worldbuilding: 0.1,
      readability: 0.3,
    },
  },
  {
    id: 'editor',
    name: '編集者',
    description: '商業的価値を重視',
    preferences: ['構成', '商業的価値'],
    evaluation_weights: {
      style: 0.2,
      plot: 0.3,
      character: 0.2,
      worldbuilding: 0.15,
      readability: 0.15,
    },
  },
];

const mockSoulText = createMockSoulText({ forbiddenWords: [] });

describe('ReaderJuryAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a jury with default personas from soul text', () => {
      const mockLLMClient = createMockLLMClient();
      const jury = new ReaderJuryAgent(mockLLMClient, mockSoulText);
      expect(jury).toBeInstanceOf(ReaderJuryAgent);
    });

    it('should accept custom personas', () => {
      const mockLLMClient = createMockLLMClient();
      const customPersonas = [mockPersonas[0], mockPersonas[1]];
      const jury = new ReaderJuryAgent(
        mockLLMClient,
        mockSoulText,
        customPersonas
      );
      expect(jury).toBeInstanceOf(ReaderJuryAgent);
    });
  });

  describe('evaluate', () => {
    it('should evaluate with all personas', async () => {
      const mockLLMClient = createMockLLMClient();
      const jury = new ReaderJuryAgent(mockLLMClient, mockSoulText);

      const result = await jury.evaluate('テスト小説');

      expect(result.evaluations).toHaveLength(4);
    });

    it('should include evaluation from each persona', async () => {
      const mockLLMClient = createMockLLMClient();
      const jury = new ReaderJuryAgent(mockLLMClient, mockSoulText);

      const result = await jury.evaluate('テスト小説');

      const personaIds = result.evaluations.map((e) => e.personaId);
      expect(personaIds).toContain('sf_fan');
      expect(personaIds).toContain('literary_girl');
      expect(personaIds).toContain('light_reader');
      expect(personaIds).toContain('editor');
    });

    it('should calculate aggregated score as mean of weighted scores', async () => {
      const mockLLMClient = createMockLLMClient();
      const jury = new ReaderJuryAgent(mockLLMClient, mockSoulText);

      const result = await jury.evaluate('テスト小説');

      const expectedMean =
        result.evaluations.reduce((sum, e) => sum + e.weightedScore, 0) /
        result.evaluations.length;
      expect(result.aggregatedScore).toBeCloseTo(expectedMean, 2);
    });

    it('should set passed=true when aggregatedScore >= 0.80', async () => {
      const mockLLMClient = createMockLLMClient();
      const jury = new ReaderJuryAgent(mockLLMClient, mockSoulText);

      const result = await jury.evaluate('高品質テキスト');

      // With all scores at ~0.78, aggregated should be around 0.78
      // The mock returns scores that average to about 0.78-0.79
      expect(result.passed).toBe(result.aggregatedScore >= 0.8);
    });

    it('should include summary', async () => {
      const mockLLMClient = createMockLLMClient();
      const jury = new ReaderJuryAgent(mockLLMClient, mockSoulText);

      const result = await jury.evaluate('テスト小説');

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
    });

    it('should run evaluations in parallel', async () => {
      const mockLLMClient = createMockLLMClient();
      const jury = new ReaderJuryAgent(mockLLMClient, mockSoulText);

      await jury.evaluate('テスト小説');

      // All 4 personas should be called
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(4);
    });
  });

  describe('passing threshold', () => {
    it('should use 0.80 as passing threshold', async () => {
      // Mock high scores
      const highScoreLLMClient: LLMClient = {
        complete: vi.fn().mockResolvedValue(
          JSON.stringify({
            categoryScores: {
              style: 0.9,
              plot: 0.9,
              character: 0.9,
              worldbuilding: 0.9,
              readability: 0.9,
            },
            feedback: '素晴らしい',
          })
        ),
        getTotalTokens: vi.fn().mockReturnValue(100),
      };

      const jury = new ReaderJuryAgent(highScoreLLMClient, mockSoulText);
      const result = await jury.evaluate('優秀なテキスト');

      expect(result.passed).toBe(true);
      expect(result.aggregatedScore).toBeGreaterThanOrEqual(0.8);
    });

    it('should return passed=false when score < 0.80', async () => {
      // Mock low scores
      const lowScoreLLMClient: LLMClient = {
        complete: vi.fn().mockResolvedValue(
          JSON.stringify({
            categoryScores: {
              style: 0.5,
              plot: 0.5,
              character: 0.5,
              worldbuilding: 0.5,
              readability: 0.5,
            },
            feedback: '改善が必要',
          })
        ),
        getTotalTokens: vi.fn().mockReturnValue(100),
      };

      const jury = new ReaderJuryAgent(lowScoreLLMClient, mockSoulText);
      const result = await jury.evaluate('低品質テキスト');

      expect(result.passed).toBe(false);
      expect(result.aggregatedScore).toBeLessThan(0.8);
    });
  });
});
