import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWorkRepo } from '../../src/storage/work-repository.js';
import type { WorkRepo } from '../../src/storage/work-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createWorkRepo (FP)', () => {
  let db: DatabaseConnection;
  let repo: WorkRepo;

  beforeEach(() => {
    db = new DatabaseConnection(); // in-memory
    db.runMigrations();
    repo = createWorkRepo(db.getSqlite());
  });

  afterEach(() => {
    db.close();
  });

  it('should return an object with all repository methods', () => {
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findBySoulId).toBeInstanceOf(Function);
    expect(repo.findRecentBySoulId).toBeInstanceOf(Function);
    expect(repo.update).toBeInstanceOf(Function);
    expect(repo.delete).toBeInstanceOf(Function);
  });

  describe('create', () => {
    it('should create a new work', async () => {
      const work = await repo.create({
        soulId: 'test-soul',
        title: 'Test Work',
        content: 'Content of the work',
        totalChapters: 5,
        totalTokens: 10000,
      });

      expect(work.id).toBeDefined();
      expect(work.soulId).toBe('test-soul');
      expect(work.title).toBe('Test Work');
      expect(work.status).toBe('completed');
    });

    it('should create with scores', async () => {
      const work = await repo.create({
        soulId: 'test-soul',
        title: 'Scored Work',
        content: 'Content',
        totalChapters: 3,
        totalTokens: 5000,
        complianceScore: 0.95,
        readerScore: 0.88,
      });

      expect(work.complianceScore).toBe(0.95);
      expect(work.readerScore).toBe(0.88);
    });

    it('should create with tone', async () => {
      const work = await repo.create({
        soulId: 'test-soul',
        title: 'Toned Work',
        content: 'Content',
        totalChapters: 1,
        totalTokens: 100,
        tone: 'dark',
      });

      expect(work.tone).toBe('dark');
    });
  });

  describe('findById', () => {
    it('should find a work by id', async () => {
      const created = await repo.create({
        soulId: 'test-soul',
        title: 'Find Me',
        content: 'Content',
        totalChapters: 1,
        totalTokens: 100,
      });

      const found = await repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.title).toBe('Find Me');
    });

    it('should return undefined for non-existent id', async () => {
      const found = await repo.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('findBySoulId', () => {
    it('should find all works for a soul', async () => {
      await repo.create({
        soulId: 'soul-1',
        title: 'Work 1',
        content: 'Content 1',
        totalChapters: 1,
        totalTokens: 100,
      });

      await repo.create({
        soulId: 'soul-1',
        title: 'Work 2',
        content: 'Content 2',
        totalChapters: 2,
        totalTokens: 200,
      });

      await repo.create({
        soulId: 'soul-2',
        title: 'Work 3',
        content: 'Content 3',
        totalChapters: 3,
        totalTokens: 300,
      });

      const works = await repo.findBySoulId('soul-1');

      expect(works).toHaveLength(2);
      expect(works.every((w) => w.soulId === 'soul-1')).toBe(true);
    });
  });

  describe('findRecentBySoulId', () => {
    it('should find recent completed works limited by count', async () => {
      await repo.create({ soulId: 'soul-1', title: 'W1', content: 'C', totalChapters: 1, totalTokens: 100 });
      await repo.create({ soulId: 'soul-1', title: 'W2', content: 'C', totalChapters: 1, totalTokens: 100 });
      await repo.create({ soulId: 'soul-1', title: 'W3', content: 'C', totalChapters: 1, totalTokens: 100 });

      const recent = await repo.findRecentBySoulId('soul-1', 2);

      expect(recent).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update work fields', async () => {
      const work = await repo.create({
        soulId: 'test-soul',
        title: 'Original Title',
        content: 'Original content',
        totalChapters: 1,
        totalTokens: 100,
      });

      const updated = await repo.update(work.id, {
        title: 'Updated Title',
        complianceScore: 0.9,
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.complianceScore).toBe(0.9);
      expect(updated?.content).toBe('Original content');
    });
  });

  describe('delete', () => {
    it('should delete a work', async () => {
      const work = await repo.create({
        soulId: 'test-soul',
        title: 'To Delete',
        content: 'Content',
        totalChapters: 1,
        totalTokens: 100,
      });

      await repo.delete(work.id);

      const found = await repo.findById(work.id);
      expect(found).toBeUndefined();
    });
  });
});
