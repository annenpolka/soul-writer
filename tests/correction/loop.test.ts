import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CorrectionLoop } from '../../src/correction/loop.js';
import { CorrectorAgent } from '../../src/agents/corrector.js';
import { ComplianceChecker } from '../../src/compliance/checker.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';

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
  promptConfig: { defaults: { protagonist_short: '', pronoun: '' } },

  fragments: new Map(),
};

describe('CorrectionLoop', () => {
  let mockLLMClient: LLMClient;
  let corrector: CorrectorAgent;
  let checker: ComplianceChecker;

  beforeEach(() => {
    mockLLMClient = {
      complete: vi.fn().mockResolvedValue('修正された文章です。'),
      getTotalTokens: vi.fn().mockReturnValue(100),
    };
    corrector = new CorrectorAgent(mockLLMClient, mockSoulText);
    checker = ComplianceChecker.fromSoulText(mockSoulText);
  });

  describe('constructor', () => {
    it('should create a correction loop with default max attempts', () => {
      const loop = new CorrectionLoop(corrector, checker);
      expect(loop).toBeInstanceOf(CorrectionLoop);
    });

    it('should create a correction loop with custom max attempts', () => {
      const loop = new CorrectionLoop(corrector, checker, 5);
      expect(loop).toBeInstanceOf(CorrectionLoop);
    });
  });

  describe('run', () => {
    it('should return immediately if text is already compliant', async () => {
      const loop = new CorrectionLoop(corrector, checker);
      const compliantText = '透心は静かに窓を見つめていた。';

      const result = await loop.run(compliantText);

      expect(result.success).toBe(true);
      expect(result.finalText).toBe(compliantText);
      expect(result.attempts).toBe(0);
      expect(mockLLMClient.complete).not.toHaveBeenCalled();
    });

    it('should attempt correction for non-compliant text', async () => {
      const loop = new CorrectionLoop(corrector, checker);
      const nonCompliantText = 'とても美しい朝だった。';

      await loop.run(nonCompliantText);

      expect(mockLLMClient.complete).toHaveBeenCalled();
    });

    it('should succeed when correction fixes violations', async () => {
      // Mock corrector to return compliant text
      mockLLMClient.complete = vi.fn().mockResolvedValue('美しい朝だった。');

      const loop = new CorrectionLoop(corrector, checker);
      const result = await loop.run('とても美しい朝だった。');

      expect(result.success).toBe(true);
      expect(result.finalText).toBe('美しい朝だった。');
      expect(result.attempts).toBe(1);
    });

    it('should retry up to max attempts if corrections fail', async () => {
      // Mock corrector to always return non-compliant text
      mockLLMClient.complete = vi.fn().mockResolvedValue('とても素晴らしい。');

      const loop = new CorrectionLoop(corrector, checker, 3);
      const result = await loop.run('とても美しい。');

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(3);
    });

    it('should track violations from original text on failure', async () => {
      mockLLMClient.complete = vi.fn().mockResolvedValue('とても素晴らしい。');

      const loop = new CorrectionLoop(corrector, checker, 2);
      const result = await loop.run('とても美しい。');

      expect(result.success).toBe(false);
      expect(result.originalViolations).toBeDefined();
      expect(result.originalViolations!.length).toBeGreaterThan(0);
    });

    it('should accumulate tokens used across attempts', async () => {
      let callCount = 0;
      mockLLMClient.complete = vi.fn().mockImplementation(() => {
        callCount++;
        // First two attempts return non-compliant, third returns compliant
        return Promise.resolve(callCount < 3 ? 'とても良い。' : '良い朝だ。');
      });
      mockLLMClient.getTotalTokens = vi.fn().mockReturnValue(50);

      const loop = new CorrectionLoop(corrector, checker, 3);
      const result = await loop.run('とても美しい。');

      // First check is free (no LLM call), but each correction attempt uses tokens
      expect(result.totalTokensUsed).toBe(150); // 3 attempts × 50 tokens
    });

    it('should stop early if text becomes compliant', async () => {
      let callCount = 0;
      mockLLMClient.complete = vi.fn().mockImplementation(() => {
        callCount++;
        // Second attempt succeeds
        return Promise.resolve(callCount < 2 ? 'とても良い。' : '良い朝だ。');
      });

      const loop = new CorrectionLoop(corrector, checker, 5);
      const result = await loop.run('とても美しい。');

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
    });
  });
});
