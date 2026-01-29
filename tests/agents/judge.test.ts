import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JudgeAgent } from '../../src/agents/judge.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';

// Mock LLM Client
const mockLLMClient: LLMClient = {
  complete: vi.fn().mockResolvedValue(
    JSON.stringify({
      winner: 'A',
      reasoning: 'Text A better captures the soul',
      scores: {
        A: { style: 0.8, compliance: 0.9, overall: 0.85 },
        B: { style: 0.7, compliance: 0.8, overall: 0.75 },
      },
    })
  ),
  getTotalTokens: vi.fn().mockReturnValue(100),
};

// Mock Soul Text
const mockSoulText: SoulText = {
  constitution: {
    meta: { soul_id: 'test', soul_name: 'Test Soul', version: '1.0.0', created_at: '', updated_at: '' },
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
      theme_violation: [],
      mentor_tsurgi: [],
      lion_concretization: [],
      excessive_sentiment: [],
      explanatory_worldbuilding: [],
      character_normalization: [],
      cliche_simile: [],
    },
  },
  readerPersonas: { personas: [] },
  fragments: new Map(),
};

describe('JudgeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a judge agent', () => {
      const judge = new JudgeAgent(mockLLMClient, mockSoulText);
      expect(judge).toBeInstanceOf(JudgeAgent);
    });
  });

  describe('evaluate', () => {
    it('should evaluate two texts and return winner', async () => {
      const judge = new JudgeAgent(mockLLMClient, mockSoulText);
      const result = await judge.evaluate('Text A content', 'Text B content');

      expect(result.winner).toBe('A');
      expect(result.reasoning).toBeDefined();
      expect(result.scores).toBeDefined();
    });

    it('should call LLM with both texts', async () => {
      const judge = new JudgeAgent(mockLLMClient, mockSoulText);
      await judge.evaluate('First text', 'Second text');

      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('First text'),
        expect.any(Object)
      );
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Second text'),
        expect.any(Object)
      );
    });
  });
});
