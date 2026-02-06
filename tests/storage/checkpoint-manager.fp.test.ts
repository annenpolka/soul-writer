import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCheckpointManager } from '../../src/storage/checkpoint-manager.js';
import type { CheckpointRepo, Checkpoint } from '../../src/storage/checkpoint-repository.js';

function createMockCheckpointRepo(): CheckpointRepo {
  const checkpoints: Checkpoint[] = [];

  return {
    create: vi.fn(async (input) => {
      const checkpoint: Checkpoint = {
        id: `cp-${checkpoints.length + 1}`,
        taskId: input.taskId,
        phase: input.phase,
        progress: input.progress,
        state: input.state,
        createdAt: new Date().toISOString(),
      };
      checkpoints.push(checkpoint);
      return checkpoint;
    }),
    findLatestByTaskId: vi.fn(async (taskId: string) => {
      const matching = checkpoints.filter(c => c.taskId === taskId);
      return matching.length > 0 ? matching[matching.length - 1] : undefined;
    }),
    findAllByTaskId: vi.fn(async (taskId: string) => {
      return checkpoints.filter(c => c.taskId === taskId);
    }),
    deleteByTaskId: vi.fn(async (taskId: string) => {
      const indices = checkpoints
        .map((c, i) => c.taskId === taskId ? i : -1)
        .filter(i => i >= 0)
        .reverse();
      for (const i of indices) {
        checkpoints.splice(i, 1);
      }
    }),
  };
}

describe('createCheckpointManager', () => {
  let repo: ReturnType<typeof createMockCheckpointRepo>;
  let manager: ReturnType<typeof createCheckpointManager>;

  beforeEach(() => {
    repo = createMockCheckpointRepo();
    manager = createCheckpointManager(repo);
  });

  describe('saveCheckpoint', () => {
    it('should save a checkpoint with the given state and progress', async () => {
      const checkpoint = await manager.saveCheckpoint(
        'task-1', 'plot_generation',
        { plot: 'some-plot' },
        { completedChapters: 0 }
      );

      expect(checkpoint.taskId).toBe('task-1');
      expect(checkpoint.phase).toBe('plot_generation');
      expect(checkpoint.state).toEqual({ plot: 'some-plot' });
      expect(checkpoint.progress).toEqual({ completedChapters: 0 });
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it('should default progress to empty object when not provided', async () => {
      await manager.saveCheckpoint('task-1', 'tournament', { text: 'hello' });

      expect(repo.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        phase: 'tournament',
        progress: {},
        state: { text: 'hello' },
      });
    });
  });

  describe('getLatestCheckpoint', () => {
    it('should return the latest checkpoint for a task', async () => {
      await manager.saveCheckpoint('task-1', 'plot_generation', { step: 1 });
      await manager.saveCheckpoint('task-1', 'tournament', { step: 2 });

      const latest = await manager.getLatestCheckpoint('task-1');
      expect(latest?.phase).toBe('tournament');
      expect(latest?.state).toEqual({ step: 2 });
    });

    it('should return undefined when no checkpoints exist', async () => {
      const result = await manager.getLatestCheckpoint('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('canResume', () => {
    it('should return true when checkpoints exist', async () => {
      await manager.saveCheckpoint('task-1', 'plot_generation', {});
      const result = await manager.canResume('task-1');
      expect(result).toBe(true);
    });

    it('should return false when no checkpoints exist', async () => {
      const result = await manager.canResume('task-1');
      expect(result).toBe(false);
    });
  });

  describe('getResumeState', () => {
    it('should return state with _phase and _progress metadata', async () => {
      await manager.saveCheckpoint(
        'task-1', 'chapter_start',
        { plot: { chapters: [] }, currentChapter: 0 },
        { completedChapters: 2, totalChapters: 5 }
      );

      const resumeState = await manager.getResumeState('task-1');
      expect(resumeState).toBeDefined();
      expect(resumeState!._phase).toBe('chapter_start');
      expect(resumeState!._progress).toEqual({ completedChapters: 2, totalChapters: 5 });
      expect(resumeState!.plot).toEqual({ chapters: [] });
      expect(resumeState!.currentChapter).toBe(0);
    });

    it('should return undefined when no checkpoints exist', async () => {
      const result = await manager.getResumeState('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('clearCheckpoints', () => {
    it('should remove all checkpoints for a task', async () => {
      await manager.saveCheckpoint('task-1', 'plot_generation', {});
      await manager.saveCheckpoint('task-1', 'tournament', {});

      await manager.clearCheckpoints('task-1');
      expect(repo.deleteByTaskId).toHaveBeenCalledWith('task-1');

      const canResume = await manager.canResume('task-1');
      expect(canResume).toBe(false);
    });

    it('should not affect other tasks', async () => {
      await manager.saveCheckpoint('task-1', 'plot_generation', {});
      await manager.saveCheckpoint('task-2', 'tournament', {});

      await manager.clearCheckpoints('task-1');

      const canResume1 = await manager.canResume('task-1');
      const canResume2 = await manager.canResume('task-2');
      expect(canResume1).toBe(false);
      expect(canResume2).toBe(true);
    });
  });
});
