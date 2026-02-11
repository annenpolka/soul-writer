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
    it('should extract and add candidates from publishable text', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Chapter text',
        isCompliant: true,
        verdictLevel: 'publishable',
      });

      expect(result.extracted).toBe(2);
      expect(result.added).toBe(1); // only the high-quality one (0.92 >= 0.85)
      expect(result.skipped).toBe(false);
      expect(mockExtractor.extract).toHaveBeenCalled();
    });

    it('should extract candidates from exceptional text', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Chapter text',
        isCompliant: true,
        verdictLevel: 'exceptional',
      });

      expect(result.skipped).toBe(false);
      expect(mockExtractor.extract).toHaveBeenCalled();
    });

    it('should skip for non-compliant text', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Low quality',
        isCompliant: false,
        verdictLevel: 'publishable',
      });

      expect(result.skipped).toBe(true);
      expect(result.reason?.toLowerCase()).toContain('compliance');
      expect(mockExtractor.extract).not.toHaveBeenCalled();
    });

    it('should skip for verdict below publishable', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Low quality',
        isCompliant: true,
        verdictLevel: 'acceptable',
      });

      expect(result.skipped).toBe(true);
      expect(result.reason?.toLowerCase()).toContain('verdict');
      expect(mockExtractor.extract).not.toHaveBeenCalled();
    });

    it('should skip for needs_work verdict', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId: 'work-1',
        text: 'Low quality',
        isCompliant: true,
        verdictLevel: 'needs_work',
      });

      expect(result.skipped).toBe(true);
      expect(mockExtractor.extract).not.toHaveBeenCalled();
    });
  });

  describe('getThresholds', () => {
    it('should return default thresholds', () => {
      const thresholds = pipeline.getThresholds();

      expect(thresholds.minFragmentScore).toBe(0.85);
    });

    it('should return custom thresholds', () => {
      const customPipeline = createLearningPipeline(mockExtractor, mockExpander, {
        minFragmentScore: 0.95,
      });

      const thresholds = customPipeline.getThresholds();
      expect(thresholds.minFragmentScore).toBe(0.95);
    });
  });
});
