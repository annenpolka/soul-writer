import type {
  CheckpointRepo,
  Checkpoint,
  CheckpointPhase,
} from './checkpoint-repository.js';

export interface ResumeState extends Record<string, unknown> {
  _phase: CheckpointPhase;
  _progress: Record<string, unknown>;
}

// =====================
// FP API
// =====================

export interface CheckpointManagerFn {
  saveCheckpoint: (taskId: string, phase: CheckpointPhase, state: Record<string, unknown>, progress?: Record<string, unknown>) => Promise<Checkpoint>;
  getLatestCheckpoint: (taskId: string) => Promise<Checkpoint | undefined>;
  canResume: (taskId: string) => Promise<boolean>;
  getResumeState: (taskId: string) => Promise<ResumeState | undefined>;
  clearCheckpoints: (taskId: string) => Promise<void>;
}

export function createCheckpointManager(repo: CheckpointRepo): CheckpointManagerFn {
  return {
    saveCheckpoint: async (taskId, phase, state, progress = {}) => {
      return repo.create({ taskId, phase, progress, state });
    },
    getLatestCheckpoint: async (taskId) => {
      return repo.findLatestByTaskId(taskId);
    },
    canResume: async (taskId) => {
      const checkpoint = await repo.findLatestByTaskId(taskId);
      return checkpoint !== undefined;
    },
    getResumeState: async (taskId) => {
      const checkpoint = await repo.findLatestByTaskId(taskId);
      if (!checkpoint) return undefined;
      return {
        ...checkpoint.state,
        _phase: checkpoint.phase,
        _progress: checkpoint.progress,
      };
    },
    clearCheckpoints: async (taskId) => {
      await repo.deleteByTaskId(taskId);
    },
  };
}

