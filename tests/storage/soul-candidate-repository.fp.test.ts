import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSoulCandidateRepo } from '../../src/storage/soul-candidate-repository.js';
import { createWorkRepo } from '../../src/storage/work-repository.js';
import type { SoulCandidateRepo } from '../../src/storage/soul-candidate-repository.js';
import type { WorkRepo } from '../../src/storage/work-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createSoulCandidateRepo (FP)', () => {
  let db: DatabaseConnection;
  let repo: SoulCandidateRepo;
  let workRepo: WorkRepo;
  let workId: string;

  beforeEach(async () => {
    db = new DatabaseConnection(); // in-memory
    db.runMigrations();
    repo = createSoulCandidateRepo(db.getSqlite());
    workRepo = createWorkRepo(db.getSqlite());

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

  it('should return an object with all repository methods', () => {
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findPendingBySoulId).toBeInstanceOf(Function);
    expect(repo.findApprovedBySoulId).toBeInstanceOf(Function);
    expect(repo.approve).toBeInstanceOf(Function);
    expect(repo.reject).toBeInstanceOf(Function);
    expect(repo.countByStatus).toBeInstanceOf(Function);
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

      await repo.approve(candidate2.id, 'Looks good');

      const pending = await repo.findPendingBySoulId('soul-1');

      expect(pending).toHaveLength(1);
      expect(pending[0].fragmentText).toBe('Pending 1');
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

  describe('countByStatus', () => {
    it('should count candidates by status', async () => {
      const c1 = await repo.create({
        soulId: 'soul-1',
        sourceWorkId: workId,
        fragmentText: 'F1',
        suggestedCategory: 'opening',
        autoScore: 0.9,
      });
      await repo.create({
        soulId: 'soul-1',
        sourceWorkId: workId,
        fragmentText: 'F2',
        suggestedCategory: 'closing',
        autoScore: 0.8,
      });
      const c3 = await repo.create({
        soulId: 'soul-1',
        sourceWorkId: workId,
        fragmentText: 'F3',
        suggestedCategory: 'dialogue',
        autoScore: 0.7,
      });

      await repo.approve(c1.id);
      await repo.reject(c3.id, 'Not good');

      const counts = await repo.countByStatus('soul-1');

      expect(counts.pending).toBe(1);
      expect(counts.approved).toBe(1);
      expect(counts.rejected).toBe(1);
    });

    it('should return zeros for non-existent soul', async () => {
      const counts = await repo.countByStatus('no-such-soul');

      expect(counts.pending).toBe(0);
      expect(counts.approved).toBe(0);
      expect(counts.rejected).toBe(0);
    });
  });
});
