import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CheckpointRepository } from '../../src/storage/checkpoint-repository.js';
import { TaskRepository } from '../../src/storage/task-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('CheckpointRepository', () => {
  let db: DatabaseConnection;
  let taskRepo: TaskRepository;
  let checkpointRepo: CheckpointRepository;
  let taskId: string;

  beforeEach(async () => {
    db = new DatabaseConnection(); // in-memory
    db.runMigrations();
    taskRepo = new TaskRepository(db);
    checkpointRepo = new CheckpointRepository(db);

    // Create a task to associate checkpoints with
    const task = await taskRepo.create({
      soulId: 'test-soul',
      params: { prompt: 'Test' },
    });
    taskId = task.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a checkpoint', async () => {
      const checkpoint = await checkpointRepo.create({
        taskId,
        phase: 'plot_generation',
        progress: { currentChapter: 0, totalChapters: 5 },
        state: { plot: { title: 'Test', chapters: [] } },
      });

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.taskId).toBe(taskId);
      expect(checkpoint.phase).toBe('plot_generation');
    });
  });

  describe('findLatestByTaskId', () => {
    it('should find the latest checkpoint for a task', async () => {
      await checkpointRepo.create({
        taskId,
        phase: 'plot_generation',
        progress: { currentChapter: 0 },
        state: {},
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await checkpointRepo.create({
        taskId,
        phase: 'chapter_start',
        progress: { currentChapter: 1 },
        state: {},
      });

      const latest = await checkpointRepo.findLatestByTaskId(taskId);

      expect(latest?.phase).toBe('chapter_start');
      expect(latest?.progress.currentChapter).toBe(1);
    });

    it('should return undefined for task without checkpoints', async () => {
      const latest = await checkpointRepo.findLatestByTaskId('no-checkpoints');
      expect(latest).toBeUndefined();
    });
  });

  describe('findAllByTaskId', () => {
    it('should find all checkpoints for a task', async () => {
      await checkpointRepo.create({
        taskId,
        phase: 'plot_generation',
        progress: {},
        state: {},
      });

      await checkpointRepo.create({
        taskId,
        phase: 'chapter_start',
        progress: {},
        state: {},
      });

      await checkpointRepo.create({
        taskId,
        phase: 'tournament',
        progress: {},
        state: {},
      });

      const all = await checkpointRepo.findAllByTaskId(taskId);

      expect(all).toHaveLength(3);
    });
  });

  describe('deleteByTaskId', () => {
    it('should delete all checkpoints for a task', async () => {
      await checkpointRepo.create({
        taskId,
        phase: 'plot_generation',
        progress: {},
        state: {},
      });

      await checkpointRepo.create({
        taskId,
        phase: 'chapter_start',
        progress: {},
        state: {},
      });

      await checkpointRepo.deleteByTaskId(taskId);

      const all = await checkpointRepo.findAllByTaskId(taskId);
      expect(all).toHaveLength(0);
    });
  });
});
