import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CorrectorAgent } from '../../src/agents/corrector.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { Violation } from '../../src/agents/types.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

const mockLLMClient: LLMClient = {
  complete: vi.fn().mockResolvedValue('Corrected text without violations.'),
  getTotalTokens: vi.fn().mockReturnValue(100),
};

const mockSoulText = createMockSoulText({
  forbiddenSimiles: ['天使のような'],
  deep: {
    constitution: {
      universal: {
        vocabulary: {
          special_marks: { mark: '×', usage: 'test', forms: ['×した'] },
        },
      },
    },
  } as never,
});

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
