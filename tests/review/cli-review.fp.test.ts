/**
 * FP CLIReview Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { createCLIReview, type CLIReviewFn } from '../../src/review/cli-review.js';
import type { SoulExpanderFn } from '../../src/learning/soul-expander.js';

const createMockExpander = (): SoulExpanderFn => ({
  addCandidates: vi.fn().mockResolvedValue({ added: 1 }),
  getPendingCandidates: vi.fn().mockResolvedValue([
    { id: 'c1', fragmentText: 'テスト断片', suggestedCategory: 'opening', autoScore: 0.9, status: 'pending' },
  ]),
  approveCandidate: vi.fn().mockResolvedValue({ id: 'c1', status: 'approved' }),
  rejectCandidate: vi.fn().mockResolvedValue({ id: 'c1', status: 'rejected' }),
  getApprovedCandidates: vi.fn().mockResolvedValue([]),
  getCountsByStatus: vi.fn().mockResolvedValue({ pending: 3, approved: 5, rejected: 2 }),
});

describe('createCLIReview (FP)', () => {
  it('should create a CLIReviewFn', () => {
    const expander = createMockExpander();
    const review: CLIReviewFn = createCLIReview(expander);
    expect(review.getPendingCandidates).toBeInstanceOf(Function);
    expect(review.reviewCandidate).toBeInstanceOf(Function);
    expect(review.formatCandidateForDisplay).toBeInstanceOf(Function);
    expect(review.getReviewStats).toBeInstanceOf(Function);
  });

  it('should get pending candidates', async () => {
    const expander = createMockExpander();
    const review = createCLIReview(expander);
    const candidates = await review.getPendingCandidates('soul-1');
    expect(candidates).toHaveLength(1);
    expect(expander.getPendingCandidates).toHaveBeenCalledWith('soul-1');
  });

  it('should approve a candidate', async () => {
    const expander = createMockExpander();
    const review = createCLIReview(expander);
    const result = await review.reviewCandidate('c1', 'approve', 'good');
    expect(expander.approveCandidate).toHaveBeenCalledWith('c1', 'good');
    expect(result).toBeDefined();
  });

  it('should reject a candidate', async () => {
    const expander = createMockExpander();
    const review = createCLIReview(expander);
    await review.reviewCandidate('c1', 'reject', 'bad');
    expect(expander.rejectCandidate).toHaveBeenCalledWith('c1', 'bad');
  });

  it('should format candidate for display', () => {
    const expander = createMockExpander();
    const review = createCLIReview(expander);
    const display = review.formatCandidateForDisplay({
      id: 'c1',
      fragmentText: 'テスト断片',
      suggestedCategory: 'opening',
      autoScore: 0.9,
      status: 'pending',
    } as any);
    expect(display).toContain('c1');
    expect(display).toContain('テスト断片');
    expect(display).toContain('opening');
  });

  it('should get review stats', async () => {
    const expander = createMockExpander();
    const review = createCLIReview(expander);
    const stats = await review.getReviewStats('soul-1');
    expect(stats.pending).toBe(3);
    expect(stats.approved).toBe(5);
    expect(stats.rejected).toBe(2);
    expect(stats.total).toBe(10);
  });
});
