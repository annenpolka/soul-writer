import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FragmentExtractor } from '../../src/learning/fragment-extractor.js';
import type { LLMClient } from '../../src/llm/types.js';

const mockLLMClient: LLMClient = {
  complete: vi.fn().mockResolvedValue(
    JSON.stringify({
      fragments: [
        {
          text: 'A beautiful passage about inner turmoil',
          category: 'introspection',
          score: 0.92,
          reason: 'Captures the emotional depth well',
        },
        {
          text: 'Sharp dialogue that reveals character',
          category: 'dialogue',
          score: 0.88,
          reason: 'Natural flow and subtext',
        },
      ],
    })
  ),
  getTotalTokens: vi.fn().mockReturnValue(200),
};

describe('FragmentExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an extractor', () => {
      const extractor = new FragmentExtractor(mockLLMClient);
      expect(extractor).toBeInstanceOf(FragmentExtractor);
    });
  });

  describe('extract', () => {
    it('should extract fragments from text', async () => {
      const extractor = new FragmentExtractor(mockLLMClient);
      const text = 'Long chapter text with multiple paragraphs...';

      const result = await extractor.extract(text, {
        complianceScore: 0.95,
        readerScore: 0.88,
      });

      expect(result.fragments).toHaveLength(2);
      expect(result.fragments[0].category).toBe('introspection');
      expect(result.fragments[1].category).toBe('dialogue');
    });

    it('should include scores in results', async () => {
      const extractor = new FragmentExtractor(mockLLMClient);
      const result = await extractor.extract('Test text', {
        complianceScore: 0.9,
        readerScore: 0.85,
      });

      expect(result.fragments[0].score).toBe(0.92);
    });

    it('should call LLM with text and context', async () => {
      const extractor = new FragmentExtractor(mockLLMClient);
      await extractor.extract('Test chapter content', {
        complianceScore: 0.9,
        readerScore: 0.85,
      });

      expect(mockLLMClient.complete).toHaveBeenCalledTimes(1);
      const userPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userPrompt).toContain('Test chapter content');
    });

    it('should handle empty fragments response', async () => {
      (mockLLMClient.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({ fragments: [] })
      );

      const extractor = new FragmentExtractor(mockLLMClient);
      const result = await extractor.extract('Text with no good fragments', {
        complianceScore: 0.7,
        readerScore: 0.6,
      });

      expect(result.fragments).toHaveLength(0);
    });

    it('should return tokens used', async () => {
      const extractor = new FragmentExtractor(mockLLMClient);
      const result = await extractor.extract('Test', {
        complianceScore: 0.9,
        readerScore: 0.9,
      });

      expect(result.tokensUsed).toBe(200);
    });
  });

  describe('filterHighQuality', () => {
    it('should filter fragments by minimum score', async () => {
      const extractor = new FragmentExtractor(mockLLMClient);
      const result = await extractor.extract('Text', {
        complianceScore: 0.9,
        readerScore: 0.9,
      });

      const highQuality = extractor.filterHighQuality(result.fragments, 0.9);

      expect(highQuality).toHaveLength(1);
      expect(highQuality[0].score).toBe(0.92);
    });
  });
});
