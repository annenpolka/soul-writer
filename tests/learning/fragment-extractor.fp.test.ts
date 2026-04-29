import { describe, it, expect } from 'vitest';
import {
  createFragmentExtractor,
  type FragmentExtractorFn,
} from '../../src/learning/fragment-extractor.js';
import { createMockLLMClientWithStructured } from '../helpers/mock-deps.js';

const sampleFragments = [
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
];

describe('createFragmentExtractor (FP)', () => {
  let extractor: FragmentExtractorFn;

  describe('extract', () => {
    it('should extract fragments from text via structured output', async () => {
      const llm = createMockLLMClientWithStructured({ fragments: sampleFragments }, { tokenCount: 200 });
      extractor = createFragmentExtractor(llm);

      const result = await extractor.extract('Long chapter text...', {
        complianceScore: 0.95,
        readerScore: 0.88,
      });

      expect(result.fragments).toHaveLength(2);
      expect(result.fragments[0].category).toBe('introspection');
      expect(result.fragments[1].category).toBe('dialogue');
    });

    it('should return tokens used', async () => {
      const llm = createMockLLMClientWithStructured({ fragments: sampleFragments }, { tokenCount: 200 });
      extractor = createFragmentExtractor(llm);

      const result = await extractor.extract('Test', {
        complianceScore: 0.9,
        readerScore: 0.9,
      });

      expect(result.tokensUsed).toBe(0);
    });

    it('should fallback to empty fragments on malformed structured data', async () => {
      const llm = createMockLLMClientWithStructured({ wrong: [] }, { tokenCount: 50 });
      extractor = createFragmentExtractor(llm);

      const result = await extractor.extract('Text', {
        complianceScore: 0.9,
        readerScore: 0.9,
      });

      expect(result.fragments).toHaveLength(0);
    });

    it('should handle empty fragments response', async () => {
      const llm = createMockLLMClientWithStructured({ fragments: [] }, { tokenCount: 30 });
      extractor = createFragmentExtractor(llm);

      const result = await extractor.extract('Text', {
        complianceScore: 0.7,
        readerScore: 0.6,
      });

      expect(result.fragments).toHaveLength(0);
    });
  });

  describe('filterHighQuality', () => {
    it('should filter fragments by minimum score', async () => {
      const llm = createMockLLMClientWithStructured({ fragments: sampleFragments }, { tokenCount: 100 });
      extractor = createFragmentExtractor(llm);

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
