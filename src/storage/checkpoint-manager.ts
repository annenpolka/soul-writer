import type {
  CheckpointRepository,
  Checkpoint,
  CheckpointPhase,
} from './checkpoint-repository.js';

export interface ResumeState extends Record<string, unknown> {
  _phase: CheckpointPhase;
  _progress: Record<string, unknown>;
}

/**
 * High-level manager for checkpoint operations
 * Provides convenient methods for saving and resuming from checkpoints
 */
export class CheckpointManager {
  private repo: CheckpointRepository;

  constructor(repo: CheckpointRepository) {
    this.repo = repo;
  }

  /**
   * Save a checkpoint with current state
   */
  async saveCheckpoint(
    taskId: string,
    phase: CheckpointPhase,
    state: Record<string, unknown>,
    progress: Record<string, unknown> = {}
  ): Promise<Checkpoint> {
    return this.repo.create({
      taskId,
      phase,
      progress,
      state,
    });
  }

  /**
   * Get the most recent checkpoint for a task
   */
  async getLatestCheckpoint(taskId: string): Promise<Checkpoint | undefined> {
    return this.repo.findLatestByTaskId(taskId);
  }

  /**
   * Check if a task can be resumed from a checkpoint
   */
  async canResume(taskId: string): Promise<boolean> {
    const checkpoint = await this.repo.findLatestByTaskId(taskId);
    return checkpoint !== undefined;
  }

  /**
   * Get the state needed to resume a task
   * Returns the state merged with metadata about the checkpoint
   */
  async getResumeState(taskId: string): Promise<ResumeState | undefined> {
    const checkpoint = await this.repo.findLatestByTaskId(taskId);
    if (!checkpoint) return undefined;

    return {
      ...checkpoint.state,
      _phase: checkpoint.phase,
      _progress: checkpoint.progress,
    };
  }

  /**
   * Clear all checkpoints for a task
   */
  async clearCheckpoints(taskId: string): Promise<void> {
    await this.repo.deleteByTaskId(taskId);
  }
}
