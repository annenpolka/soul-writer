import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CheckpointManager } from '../../src/storage/checkpoint-manager.js';
import { DatabaseConnection } from '../../src/storage/database.js';
import { TaskRepository } from '../../src/storage/task-repository.js';
import { CheckpointRepository } from '../../src/storage/checkpoint-repository.js';

describe('CheckpointManager', () => {
  let db: DatabaseConnection;
  let taskRepo: TaskRepository;
  let checkpointRepo: CheckpointRepository;
  let manager: CheckpointManager;
  let taskId: string;

  beforeEach(async () => {
    db = new DatabaseConnection(); // in-memory
    db.runMigrations();
    taskRepo = new TaskRepository(db);
    checkpointRepo = new CheckpointRepository(db);
    manager = new CheckpointManager(checkpointRepo);

    // Create a task
    const task = await taskRepo.create({
      soulId: 'test-soul',
      params: { prompt: 'Test' },
    });
    taskId = task.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('saveCheckpoint', () => {
    it('should save a checkpoint', async () => {
      const checkpoint = await manager.saveCheckpoint(taskId, 'plot_generation', {
        plot: { title: 'Test', chapters: [] },
        currentChapter: 0,
      });

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.phase).toBe('plot_generation');
    });

    it('should save progress and state separately', async () => {
      const checkpoint = await manager.saveCheckpoint(
        taskId,
        'chapter_start',
        { chapters: [{ text: 'Chapter 1' }] },
        { currentChapter: 1, totalChapters: 5 }
      );

      expect(checkpoint.state.chapters).toBeDefined();
      expect(checkpoint.progress.currentChapter).toBe(1);
    });
  });

  describe('getLatestCheckpoint', () => {
    it('should get the latest checkpoint', async () => {
      await manager.saveCheckpoint(taskId, 'plot_generation', { plot: {} });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.saveCheckpoint(taskId, 'chapter_start', { chapter: 1 });

      const latest = await manager.getLatestCheckpoint(taskId);

      expect(latest?.phase).toBe('chapter_start');
    });

    it('should return undefined when no checkpoints exist', async () => {
      const latest = await manager.getLatestCheckpoint('no-task');
      expect(latest).toBeUndefined();
    });
  });

  describe('canResume', () => {
    it('should return true if checkpoint exists', async () => {
      await manager.saveCheckpoint(taskId, 'plot_generation', {});

      const canResume = await manager.canResume(taskId);

      expect(canResume).toBe(true);
    });

    it('should return false if no checkpoint exists', async () => {
      const canResume = await manager.canResume('no-task');

      expect(canResume).toBe(false);
    });
  });

  describe('getResumeState', () => {
    it('should return state from latest checkpoint', async () => {
      await manager.saveCheckpoint(taskId, 'plot_generation', {
        plot: { title: 'My Story' },
      });

      const state = await manager.getResumeState(taskId);

      expect((state?.plot as { title: string })?.title).toBe('My Story');
    });

    it('should return state with progress info', async () => {
      await manager.saveCheckpoint(
        taskId,
        'chapter_start',
        { chapters: [] },
        { currentChapter: 2, totalChapters: 5 }
      );

      const state = await manager.getResumeState(taskId);

      expect(state?._progress.currentChapter).toBe(2);
      expect(state?._phase).toBe('chapter_start');
    });
  });

  describe('clearCheckpoints', () => {
    it('should clear all checkpoints for a task', async () => {
      await manager.saveCheckpoint(taskId, 'plot_generation', {});
      await manager.saveCheckpoint(taskId, 'chapter_start', {});

      await manager.clearCheckpoints(taskId);

      const canResume = await manager.canResume(taskId);
      expect(canResume).toBe(false);
    });
  });
});
