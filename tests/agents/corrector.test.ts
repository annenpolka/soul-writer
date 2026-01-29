import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CorrectorAgent } from '../../src/agents/corrector.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';
import type { Violation } from '../../src/agents/types.js';

const mockLLMClient: LLMClient = {
  complete: vi.fn().mockResolvedValue('Corrected text without violations.'),
  getTotalTokens: vi.fn().mockReturnValue(100),
};

const mockSoulText: SoulText = {
  constitution: {
    meta: { soul_id: 'test', soul_name: 'Test', version: '1.0', created_at: '', updated_at: '' },
    sentence_structure: {
      rhythm_pattern: 'test',
      taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
      typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
    },
    vocabulary: {
      bracket_notations: [],
      forbidden_words: ['とても'],
      characteristic_expressions: [],
      special_marks: { mark: '×', usage: 'test', forms: ['×した'] },
    },
    rhetoric: {
      simile_base: 'test',
      metaphor_density: 'low',
      forbidden_similes: ['天使のような'],
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

describe('CorrectorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a corrector agent', () => {
      const corrector = new CorrectorAgent(mockLLMClient, mockSoulText);
      expect(corrector).toBeInstanceOf(CorrectorAgent);
    });
  });

  describe('correct', () => {
    it('should call LLM with text and violations', async () => {
      const corrector = new CorrectorAgent(mockLLMClient, mockSoulText);
      const violations: Violation[] = [
        {
          type: 'forbidden_word',
          position: { start: 0, end: 3 },
          context: 'とても美しい',
          rule: 'Forbidden word: とても',
          severity: 'error',
        },
      ];

      const result = await corrector.correct('とても美しい文章', violations);

      expect(mockLLMClient.complete).toHaveBeenCalledTimes(1);
      expect(result.correctedText).toBeDefined();
    });

    it('should include violation information in prompt', async () => {
      const corrector = new CorrectorAgent(mockLLMClient, mockSoulText);
      const violations: Violation[] = [
        {
          type: 'forbidden_word',
          position: { start: 0, end: 3 },
          context: 'とても美しい',
          rule: 'Forbidden word: とても',
          severity: 'error',
        },
      ];

      await corrector.correct('とても美しい文章', violations);

      // Check user prompt (second argument) contains violation info
      const userPromptArg = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userPromptArg).toContain('とても');
      expect(userPromptArg).toContain('forbidden_word');
    });

    it('should return correction result with token count', async () => {
      const corrector = new CorrectorAgent(mockLLMClient, mockSoulText);
      const violations: Violation[] = [
        {
          type: 'forbidden_word',
          position: { start: 0, end: 3 },
          context: 'とても',
          rule: 'test',
          severity: 'error',
        },
      ];

      const result = await corrector.correct('とても美しい', violations);

      expect(result.correctedText).toBe('Corrected text without violations.');
      expect(result.tokensUsed).toBe(100);
    });

    it('should handle multiple violations', async () => {
      const corrector = new CorrectorAgent(mockLLMClient, mockSoulText);
      const violations: Violation[] = [
        {
          type: 'forbidden_word',
          position: { start: 0, end: 3 },
          context: 'とても',
          rule: 'test',
          severity: 'error',
        },
        {
          type: 'forbidden_simile',
          position: { start: 10, end: 16 },
          context: '天使のような',
          rule: 'test',
          severity: 'error',
        },
      ];

      const result = await corrector.correct('とても美しい天使のような笑顔', violations);

      // Check user prompt (second argument) contains both violations
      const userPromptArg = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userPromptArg).toContain('とても');
      expect(userPromptArg).toContain('天使のような');
      expect(result.correctedText).toBeDefined();
    });
  });
});
