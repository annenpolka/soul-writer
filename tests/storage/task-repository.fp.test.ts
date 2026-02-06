import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTaskRepo } from '../../src/storage/task-repository.js';
import type { TaskRepo } from '../../src/storage/task-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createTaskRepo (FP)', () => {
  let db: DatabaseConnection;
  let repo: TaskRepo;

  beforeEach(() => {
    db = new DatabaseConnection(); // in-memory
    db.runMigrations();
    repo = createTaskRepo(db.getSqlite());
  });

  afterEach(() => {
    db.close();
  });

  it('should return an object with all repository methods', () => {
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findPending).toBeInstanceOf(Function);
    expect(repo.markStarted).toBeInstanceOf(Function);
    expect(repo.markCompleted).toBeInstanceOf(Function);
    expect(repo.markFailed).toBeInstanceOf(Function);
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const task = await repo.create({
        soulId: 'test-soul',
        params: { prompt: 'Test prompt', chapters: 5 },
      });

      expect(task.id).toBeDefined();
      expect(task.soulId).toBe('test-soul');
      expect(task.status).toBe('pending');
      expect(task.params.prompt).toBe('Test prompt');
    });
  });

  describe('findById', () => {
    it('should find a task by id', async () => {
      const created = await repo.create({
        soulId: 'test-soul',
        params: { prompt: 'Find me' },
      });

      const found = await repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.params.prompt).toBe('Find me');
    });

    it('should return undefined for non-existent id', async () => {
      const found = await repo.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('findPending', () => {
    it('should find pending tasks', async () => {
      await repo.create({
        soulId: 'soul-1',
        params: { prompt: 'Task 1' },
      });

      const task2 = await repo.create({
        soulId: 'soul-1',
        params: { prompt: 'Task 2' },
      });

      await repo.markStarted(task2.id);

      const pending = await repo.findPending();

      expect(pending).toHaveLength(1);
      expect(pending[0].params.prompt).toBe('Task 1');
    });

    it('should return pending tasks in order', async () => {
      await repo.create({
        soulId: 'soul-1',
        params: { prompt: 'First' },
      });

      await repo.create({
        soulId: 'soul-1',
        params: { prompt: 'Second' },
      });

      const pending = await repo.findPending();

      expect(pending[0].params.prompt).toBe('First');
      expect(pending[1].params.prompt).toBe('Second');
    });
  });

  describe('markStarted', () => {
    it('should mark task as running', async () => {
      const task = await repo.create({
        soulId: 'test-soul',
        params: { prompt: 'Test' },
      });

      const updated = await repo.markStarted(task.id);

      expect(updated?.status).toBe('running');
      expect(updated?.startedAt).toBeDefined();
    });
  });

  describe('markCompleted', () => {
    it('should mark task as completed', async () => {
      const task = await repo.create({
        soulId: 'test-soul',
        params: { prompt: 'Test' },
      });

      await repo.markStarted(task.id);
      const updated = await repo.markCompleted(task.id);

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });
  });

  describe('markFailed', () => {
    it('should mark task as failed with error', async () => {
      const task = await repo.create({
        soulId: 'test-soul',
        params: { prompt: 'Test' },
      });

      await repo.markStarted(task.id);
      const updated = await repo.markFailed(task.id, 'Something went wrong');

      expect(updated?.status).toBe('failed');
      expect(updated?.error).toBe('Something went wrong');
    });
  });
});
