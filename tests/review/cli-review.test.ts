import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CLIReview } from '../../src/review/cli-review.js';
import { SoulExpander } from '../../src/learning/soul-expander.js';
import { SoulCandidateRepository } from '../../src/storage/soul-candidate-repository.js';
import { WorkRepository } from '../../src/storage/work-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('CLIReview', () => {
  let db: DatabaseConnection;
  let candidateRepo: SoulCandidateRepository;
  let workRepo: WorkRepository;
  let expander: SoulExpander;
  let review: CLIReview;
  let workId: string;

  beforeEach(async () => {
    db = new DatabaseConnection();
    db.runMigrations();
    candidateRepo = new SoulCandidateRepository(db);
    workRepo = new WorkRepository(db);
    expander = new SoulExpander(candidateRepo);
    review = new CLIReview(expander);

    const work = await workRepo.create({
      soulId: 'test-soul',
      title: 'Test Work',
      content: 'Content',
      totalChapters: 1,
      totalTokens: 100,
    });
    workId = work.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('getPendingCandidates', () => {
    it('should return pending candidates for review', async () => {
      // Add candidates
      await expander.addCandidates('test-soul', workId, [
        { text: 'Fragment 1', category: 'opening', score: 0.9, reason: 'Good' },
        { text: 'Fragment 2', category: 'closing', score: 0.85, reason: 'Nice' },
      ]);

      const candidates = await review.getPendingCandidates('test-soul');

      expect(candidates).toHaveLength(2);
    });

    it('should return empty array when no pending candidates', async () => {
      const candidates = await review.getPendingCandidates('test-soul');
      expect(candidates).toHaveLength(0);
    });
  });

  describe('reviewCandidate', () => {
    it('should approve candidate', async () => {
      const { candidates } = await expander.addCandidates('test-soul', workId, [
        { text: 'To approve', category: 'introspection', score: 0.95, reason: 'Great' },
      ]);

      const result = await review.reviewCandidate(candidates[0].id, 'approve', 'Excellent');

      expect(result?.status).toBe('approved');
      expect(result?.reviewerNotes).toBe('Excellent');
    });

    it('should reject candidate', async () => {
      const { candidates } = await expander.addCandidates('test-soul', workId, [
        { text: 'To reject', category: 'dialogue', score: 0.7, reason: 'Average' },
      ]);

      const result = await review.reviewCandidate(candidates[0].id, 'reject', 'Not suitable');

      expect(result?.status).toBe('rejected');
      expect(result?.reviewerNotes).toBe('Not suitable');
    });
  });

  describe('formatCandidateForDisplay', () => {
    it('should format candidate for CLI display', async () => {
      const { candidates } = await expander.addCandidates('test-soul', workId, [
        { text: 'Beautiful fragment', category: 'introspection', score: 0.92, reason: 'Deep' },
      ]);

      const formatted = review.formatCandidateForDisplay(candidates[0]);

      expect(formatted).toContain('introspection');
      expect(formatted).toContain('Beautiful fragment');
      expect(formatted).toContain('0.92');
    });
  });

  describe('getReviewStats', () => {
    it('should return review statistics', async () => {
      const { candidates } = await expander.addCandidates('test-soul', workId, [
        { text: 'Fragment 1', category: 'opening', score: 0.9, reason: 'Good' },
        { text: 'Fragment 2', category: 'closing', score: 0.85, reason: 'Nice' },
        { text: 'Fragment 3', category: 'dialogue', score: 0.88, reason: 'Fine' },
      ]);

      await review.reviewCandidate(candidates[0].id, 'approve');
      await review.reviewCandidate(candidates[1].id, 'reject');

      const stats = await review.getReviewStats('test-soul');

      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.total).toBe(3);
    });
  });
});
