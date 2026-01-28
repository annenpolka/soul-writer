import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReaderEvaluator } from '../../src/agents/reader-evaluator.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';
import type { ReaderPersona } from '../../src/schemas/reader-personas.js';

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
      must_preserve: [],
      forbidden_resolutions: [],
    },
  },
  worldBible: {
    technology: {},
    society: {},
    characters: {},
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
    },
  },
  readerPersonas: { personas: [] },
  fragments: new Map(),
};

// Mock Reader Persona - SF愛好家
const mockPersona: ReaderPersona = {
  id: 'sf_fan',
  name: 'SF愛好家',
  description: 'SFの技術的整合性を重視する読者',
  preferences: ['世界設定の緻密さ', 'SF的整合性'],
  evaluation_weights: {
    style: 0.2,
    plot: 0.2,
    character: 0.2,
    worldbuilding: 0.3,
    readability: 0.1,
  },
};

// Valid evaluation response
const validEvaluationResponse = JSON.stringify({
  categoryScores: {
    style: 0.8,
    plot: 0.75,
    character: 0.7,
    worldbuilding: 0.9,
    readability: 0.85,
  },
  feedback:
    '世界観の構築が優れており、SF的な設定の整合性が保たれている。',
});

describe('ReaderEvaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a reader evaluator with persona', () => {
      const mockLLMClient = createMockLLMClient(validEvaluationResponse);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );
      expect(evaluator).toBeInstanceOf(ReaderEvaluator);
    });
  });

  describe('evaluate', () => {
    it('should return evaluation with category scores', async () => {
      const mockLLMClient = createMockLLMClient(validEvaluationResponse);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      const result = await evaluator.evaluate('テスト小説テキスト');

      expect(result.categoryScores).toBeDefined();
      expect(result.categoryScores.style).toBe(0.8);
      expect(result.categoryScores.worldbuilding).toBe(0.9);
    });

    it('should calculate weighted score using persona weights', async () => {
      const mockLLMClient = createMockLLMClient(validEvaluationResponse);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      const result = await evaluator.evaluate('テスト小説テキスト');

      // Expected: 0.8*0.2 + 0.75*0.2 + 0.7*0.2 + 0.9*0.3 + 0.85*0.1
      // = 0.16 + 0.15 + 0.14 + 0.27 + 0.085 = 0.805
      expect(result.weightedScore).toBeCloseTo(0.805, 2);
    });

    it('should include persona id and name', async () => {
      const mockLLMClient = createMockLLMClient(validEvaluationResponse);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      const result = await evaluator.evaluate('テスト小説テキスト');

      expect(result.personaId).toBe('sf_fan');
      expect(result.personaName).toBe('SF愛好家');
    });

    it('should include qualitative feedback', async () => {
      const mockLLMClient = createMockLLMClient(validEvaluationResponse);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      const result = await evaluator.evaluate('テスト小説テキスト');

      expect(result.feedback).toBeDefined();
      expect(typeof result.feedback).toBe('string');
      expect(result.feedback).toContain('世界観');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should include persona name and preferences', async () => {
      const mockLLMClient = createMockLLMClient(validEvaluationResponse);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      await evaluator.evaluate('テスト');

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(systemPrompt).toContain('SF愛好家');
      expect(systemPrompt).toContain('世界設定の緻密さ');
    });

    it('should include evaluation criteria', async () => {
      const mockLLMClient = createMockLLMClient(validEvaluationResponse);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      await evaluator.evaluate('テスト');

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(systemPrompt).toContain('style');
      expect(systemPrompt).toContain('worldbuilding');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', async () => {
      const mockLLMClient = createMockLLMClient(validEvaluationResponse);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      const result = await evaluator.evaluate('テスト');

      expect(result.categoryScores.style).toBe(0.8);
    });

    it('should extract JSON from markdown code block', async () => {
      const responseWithCodeBlock = `
評価結果:

\`\`\`json
${validEvaluationResponse}
\`\`\`
`;
      const mockLLMClient = createMockLLMClient(responseWithCodeBlock);
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      const result = await evaluator.evaluate('テスト');

      expect(result.categoryScores.style).toBe(0.8);
    });

    it('should use fallback scores on invalid JSON', async () => {
      const mockLLMClient = createMockLLMClient('This is not JSON');
      const evaluator = new ReaderEvaluator(
        mockLLMClient,
        mockSoulText,
        mockPersona
      );

      const result = await evaluator.evaluate('テスト');

      // Fallback scores should be 0.5
      expect(result.categoryScores.style).toBe(0.5);
      expect(result.categoryScores.plot).toBe(0.5);
    });
  });
});
