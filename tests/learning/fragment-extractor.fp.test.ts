import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFragmentExtractor,
  type FragmentExtractorFn,
} from '../../src/learning/fragment-extractor.js';
import { createMockLLMClient } from '../helpers/mock-deps.js';

const fragmentsResponse = JSON.stringify({
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
});

describe('createFragmentExtractor (FP)', () => {
  let extractor: FragmentExtractorFn;
  let mockLLM: ReturnType<typeof createMockLLMClient>;

  beforeEach(() => {
    mockLLM = createMockLLMClient(fragmentsResponse, 200);
    extractor = createFragmentExtractor(mockLLM);
  });

  describe('extract', () => {
    it('should extract fragments from text', async () => {
      const result = await extractor.extract('Long chapter text...', {
        complianceScore: 0.95,
        readerScore: 0.88,
      });

      expect(result.fragments).toHaveLength(2);
      expect(result.fragments[0].category).toBe('introspection');
      expect(result.fragments[1].category).toBe('dialogue');
    });

    it('should return tokens used', async () => {
      const result = await extractor.extract('Test', {
        complianceScore: 0.9,
        readerScore: 0.9,
      });

      expect(result.tokensUsed).toBe(200);
    });

    it('should handle invalid JSON gracefully', async () => {
      const badLLM = createMockLLMClient('not json', 50);
      const ext = createFragmentExtractor(badLLM);

      const result = await ext.extract('Text', {
        complianceScore: 0.9,
        readerScore: 0.9,
      });

      expect(result.fragments).toHaveLength(0);
      expect(result.tokensUsed).toBe(50);
    });

    it('should handle empty fragments response', async () => {
      const emptyLLM = createMockLLMClient(JSON.stringify({ fragments: [] }), 30);
      const ext = createFragmentExtractor(emptyLLM);

      const result = await ext.extract('Text', {
        complianceScore: 0.7,
        readerScore: 0.6,
      });

      expect(result.fragments).toHaveLength(0);
    });
  });

  describe('filterHighQuality', () => {
    it('should filter fragments by minimum score', async () => {
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
