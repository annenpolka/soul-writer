import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createLearningPipeline,
  type LearningRunner,
} from '../../src/learning/learning-pipeline.js';
import type { FragmentExtractorFn } from '../../src/learning/fragment-extractor.js';
import type { SoulExpanderFn } from '../../src/learning/soul-expander.js';

function createMockExtractor(): FragmentExtractorFn {
  return {
    extract: vi.fn().mockResolvedValue({
      fragments: [
        { text: 'Beautiful fragment', category: 'introspection', score: 0.92, reason: 'Good' },
        { text: 'Low fragment', category: 'dialogue', score: 0.6, reason: 'Average' },
      ],
      tokensUsed: 100,
    }),
    filterHighQuality: vi.fn().mockImplementation((fragments, minScore) =>
      fragments.filter((f: { score: number }) => f.score >= minScore)
    ),
  };
}

function createMockExpander(): SoulExpanderFn {
  return {
    addCandidates: vi.fn().mockImplementation(async (_soulId, _workId, fragments) => ({
      added: fragments.length,
      candidates: fragments.map((f: { text: string }, i: number) => ({
        id: `cand-${i}`,
        ...f,
        status: 'pending',
      })),
    })),
    getPendingCandidates: vi.fn().mockResolvedValue([]),
    approveCandidate: vi.fn().mockResolvedValue(undefined),
    rejectCandidate: vi.fn().mockResolvedValue(undefined),
    getApprovedCandidates: vi.fn().mockResolvedValue([]),
    getCountsByStatus: vi.fn().mockResolvedValue({ pending: 0, approved: 0, rejected: 0 }),
  };
}

describe('createLearningPipeline (FP)', () => {
  let pipeline: LearningRunner;
  let mockExtractor: FragmentExtractorFn;
  let mockExpander: SoulExpanderFn;

  beforeEach(() => {
    mockExtractor = createMockExtractor();
    mockExpander = createMockExpander();
    pipeline = createLearningPipeline(mockExtractor, mockExpander);
  });

  describe('process', () => {
    it('should extract and add candidates from high-scoring text', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Chapter text',
        complianceScore: 0.9,
        readerScore: 0.85,
      });

      expect(result.extracted).toBe(2);
      expect(result.added).toBe(1); // only the high-quality one (0.92 >= 0.85)
      expect(result.skipped).toBe(false);
      expect(mockExtractor.extract).toHaveBeenCalled();
    });

    it('should skip for low compliance score', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Low quality',
        complianceScore: 0.7,
        readerScore: 0.85,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason?.toLowerCase()).toContain('compliance');
      expect(mockExtractor.extract).not.toHaveBeenCalled();
    });

    it('should skip for low reader score', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Low quality',
        complianceScore: 0.9,
        readerScore: 0.7,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason?.toLowerCase()).toContain('reader');
      expect(mockExtractor.extract).not.toHaveBeenCalled();
    });

    it('should use custom thresholds', async () => {
      const strictPipeline = createLearningPipeline(mockExtractor, mockExpander, {
        minComplianceScore: 0.95,
      });

      const result = await strictPipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Text',
        complianceScore: 0.9,
        readerScore: 0.85,
      });

      expect(result.skipped).toBe(true);
    });
  });

  describe('getThresholds', () => {
    it('should return default thresholds', () => {
      const thresholds = pipeline.getThresholds();

      expect(thresholds.minComplianceScore).toBe(0.85);
      expect(thresholds.minReaderScore).toBe(0.80);
      expect(thresholds.minFragmentScore).toBe(0.85);
    });

    it('should return custom thresholds', () => {
      const customPipeline = createLearningPipeline(mockExtractor, mockExpander, {
        minComplianceScore: 0.9,
        minFragmentScore: 0.95,
      });

      const thresholds = customPipeline.getThresholds();
      expect(thresholds.minComplianceScore).toBe(0.9);
      expect(thresholds.minFragmentScore).toBe(0.95);
    });
  });
});
