import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSoulExpander,
  type SoulExpanderFn,
} from '../../src/learning/soul-expander.js';
import type { SoulCandidateRepo, SoulCandidate } from '../../src/storage/soul-candidate-repository.js';
import type { ExtractedFragment } from '../../src/learning/fragment-extractor.js';

function createMockCandidateRepo(): SoulCandidateRepo {
  let idCounter = 0;
  return {
    create: vi.fn().mockImplementation(async (input) => {
      idCounter++;
      return {
        id: `cand-${idCounter}`,
        soulId: input.soulId,
        sourceWorkId: input.sourceWorkId,
        sourceChapterId: input.sourceChapterId ?? null,
        fragmentText: input.fragmentText,
        suggestedCategory: input.suggestedCategory,
        autoScore: input.autoScore,
        status: 'pending' as const,
        reviewerNotes: null,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
      } satisfies SoulCandidate;
    }),
    findById: vi.fn().mockResolvedValue(undefined),
    findPendingBySoulId: vi.fn().mockResolvedValue([]),
    findApprovedBySoulId: vi.fn().mockResolvedValue([]),
    approve: vi.fn().mockImplementation(async (id, notes?) => ({
      id,
      soulId: 'test-soul',
      sourceWorkId: 'work-1',
      sourceChapterId: null,
      fragmentText: 'text',
      suggestedCategory: 'introspection',
      autoScore: 0.9,
      status: 'approved' as const,
      reviewerNotes: notes ?? null,
      createdAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    })),
    reject: vi.fn().mockImplementation(async (id, notes?) => ({
      id,
      soulId: 'test-soul',
      sourceWorkId: 'work-1',
      sourceChapterId: null,
      fragmentText: 'text',
      suggestedCategory: 'introspection',
      autoScore: 0.9,
      status: 'rejected' as const,
      reviewerNotes: notes ?? null,
      createdAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    })),
    countByStatus: vi.fn().mockResolvedValue({ pending: 0, approved: 0, rejected: 0 }),
  };
}

const testFragments: ExtractedFragment[] = [
  { text: 'Beautiful introspection', category: 'introspection', score: 0.92, reason: 'Deep emotion' },
  { text: 'Sharp dialogue', category: 'dialogue', score: 0.88, reason: 'Natural flow' },
];

describe('createSoulExpander (FP)', () => {
  let expander: SoulExpanderFn;
  let mockRepo: SoulCandidateRepo;

  beforeEach(() => {
    mockRepo = createMockCandidateRepo();
    expander = createSoulExpander(mockRepo);
  });

  describe('addCandidates', () => {
    it('should add fragments as candidates', async () => {
      const result = await expander.addCandidates('test-soul', 'work-1', testFragments);

      expect(result.added).toBe(2);
      expect(result.candidates).toHaveLength(2);
      expect(mockRepo.create).toHaveBeenCalledTimes(2);
    });

    it('should create candidates with correct data', async () => {
      await expander.addCandidates('test-soul', 'work-1', testFragments, 'chapter-1');

      expect(mockRepo.create).toHaveBeenCalledWith({
        soulId: 'test-soul',
        sourceWorkId: 'work-1',
        sourceChapterId: 'chapter-1',
        fragmentText: 'Beautiful introspection',
        suggestedCategory: 'introspection',
        autoScore: 0.92,
      });
    });

    it('should handle empty fragments array', async () => {
      const result = await expander.addCandidates('test-soul', 'work-1', []);

      expect(result.added).toBe(0);
      expect(result.candidates).toHaveLength(0);
    });
  });

  describe('getPendingCandidates', () => {
    it('should delegate to repo', async () => {
      await expander.getPendingCandidates('test-soul');
      expect(mockRepo.findPendingBySoulId).toHaveBeenCalledWith('test-soul');
    });
  });

  describe('approveCandidate', () => {
    it('should delegate to repo', async () => {
      const result = await expander.approveCandidate('cand-1', 'Excellent');
      expect(mockRepo.approve).toHaveBeenCalledWith('cand-1', 'Excellent');
      expect(result?.status).toBe('approved');
    });
  });

  describe('rejectCandidate', () => {
    it('should delegate to repo', async () => {
      const result = await expander.rejectCandidate('cand-1', 'Not suitable');
      expect(mockRepo.reject).toHaveBeenCalledWith('cand-1', 'Not suitable');
      expect(result?.status).toBe('rejected');
    });
  });

  describe('getApprovedCandidates', () => {
    it('should delegate to repo', async () => {
      await expander.getApprovedCandidates('test-soul');
      expect(mockRepo.findApprovedBySoulId).toHaveBeenCalledWith('test-soul');
    });
  });

  describe('getCountsByStatus', () => {
    it('should delegate to repo', async () => {
      await expander.getCountsByStatus('test-soul');
      expect(mockRepo.countByStatus).toHaveBeenCalledWith('test-soul');
    });
  });
});
