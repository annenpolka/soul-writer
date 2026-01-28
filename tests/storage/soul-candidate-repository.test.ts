import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SoulCandidateRepository } from '../../src/storage/soul-candidate-repository.js';
import { WorkRepository } from '../../src/storage/work-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('SoulCandidateRepository', () => {
  let db: DatabaseConnection;
  let repo: SoulCandidateRepository;
  let workRepo: WorkRepository;
  let workId: string;

  beforeEach(async () => {
    db = new DatabaseConnection(); // in-memory
    db.runMigrations();
    repo = new SoulCandidateRepository(db);
    workRepo = new WorkRepository(db);

    // Create a work to associate candidates with
    const work = await workRepo.create({
      soulId: 'test-soul',
      title: 'Test Work',
      content: 'Test content',
      totalChapters: 1,
      totalTokens: 100,
    });
    workId = work.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a new candidate', async () => {
      const candidate = await repo.create({
        soulId: 'test-soul',
        sourceWorkId: workId,
        fragmentText: 'A beautiful fragment of text',
        suggestedCategory: 'introspection',
        autoScore: 0.92,
      });

      expect(candidate.id).toBeDefined();
      expect(candidate.soulId).toBe('test-soul');
      expect(candidate.status).toBe('pending');
      expect(candidate.autoScore).toBe(0.92);
    });

    it('should allow null source chapter id', async () => {
      const candidate = await repo.create({
        soulId: 'test-soul',
        sourceWorkId: workId,
        fragmentText: 'Fragment text',
        suggestedCategory: 'opening',
        autoScore: 0.85,
      });

      // sourceChapterId defaults to null when not provided
      expect(candidate.sourceChapterId).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find a candidate by id', async () => {
      const created = await repo.create({
        soulId: 'test-soul',
        sourceWorkId: workId,
        fragmentText: 'Find me',
        suggestedCategory: 'dialogue',
        autoScore: 0.88,
      });

      const found = await repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.fragmentText).toBe('Find me');
    });

    it('should return undefined for non-existent id', async () => {
      const found = await repo.findById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('findPendingBySoulId', () => {
    it('should find pending candidates for a soul', async () => {
      await repo.create({
        soulId: 'soul-1',
        sourceWorkId: workId,
        fragmentText: 'Pending 1',
        suggestedCategory: 'opening',
        autoScore: 0.9,
      });

      const candidate2 = await repo.create({
        soulId: 'soul-1',
        sourceWorkId: workId,
        fragmentText: 'Pending 2',
        suggestedCategory: 'closing',
        autoScore: 0.85,
      });

      // Approve one
      await repo.approve(candidate2.id, 'Looks good');

      const pending = await repo.findPendingBySoulId('soul-1');

      expect(pending).toHaveLength(1);
      expect(pending[0].fragmentText).toBe('Pending 1');
    });
  });

  describe('approve', () => {
    it('should approve a candidate', async () => {
      const candidate = await repo.create({
        soulId: 'test-soul',
        sourceWorkId: workId,
        fragmentText: 'To approve',
        suggestedCategory: 'introspection',
        autoScore: 0.95,
      });

      const approved = await repo.approve(candidate.id, 'Great example');

      expect(approved?.status).toBe('approved');
      expect(approved?.reviewerNotes).toBe('Great example');
      expect(approved?.reviewedAt).toBeDefined();
    });
  });

  describe('reject', () => {
    it('should reject a candidate', async () => {
      const candidate = await repo.create({
        soulId: 'test-soul',
        sourceWorkId: workId,
        fragmentText: 'To reject',
        suggestedCategory: 'dialogue',
        autoScore: 0.7,
      });

      const rejected = await repo.reject(candidate.id, 'Not suitable');

      expect(rejected?.status).toBe('rejected');
      expect(rejected?.reviewerNotes).toBe('Not suitable');
    });
  });

  describe('findApprovedBySoulId', () => {
    it('should find approved candidates for a soul', async () => {
      const candidate1 = await repo.create({
        soulId: 'soul-1',
        sourceWorkId: workId,
        fragmentText: 'Approved 1',
        suggestedCategory: 'opening',
        autoScore: 0.95,
      });

      await repo.create({
        soulId: 'soul-1',
        sourceWorkId: workId,
        fragmentText: 'Pending',
        suggestedCategory: 'closing',
        autoScore: 0.85,
      });

      await repo.approve(candidate1.id, 'Great');

      const approved = await repo.findApprovedBySoulId('soul-1');

      expect(approved).toHaveLength(1);
      expect(approved[0].fragmentText).toBe('Approved 1');
    });
  });
});
