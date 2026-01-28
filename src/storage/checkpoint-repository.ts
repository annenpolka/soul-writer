import type { DatabaseConnection } from './database.js';

export type CheckpointPhase =
  | 'plot_generation'
  | 'chapter_start'
  | 'tournament'
  | 'compliance'
  | 'correction'
  | 'chapter_done'
  | 'reader_jury'
  | 'archive';

export interface Checkpoint {
  id: string;
  taskId: string;
  phase: CheckpointPhase;
  progress: Record<string, unknown>;
  state: Record<string, unknown>;
  createdAt: string;
}

export interface CreateCheckpointInput {
  taskId: string;
  phase: CheckpointPhase;
  progress: Record<string, unknown>;
  state: Record<string, unknown>;
}

/**
 * Repository for managing checkpoints in the database
 */
export class CheckpointRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async create(input: CreateCheckpointInput): Promise<Checkpoint> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const progressJson = JSON.stringify(input.progress);
    const stateJson = JSON.stringify(input.state);

    this.db.getSqlite().prepare(`
      INSERT INTO checkpoints (id, task_id, phase, progress, state, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.taskId, input.phase, progressJson, stateJson, now);

    return {
      id,
      taskId: input.taskId,
      phase: input.phase,
      progress: input.progress,
      state: input.state,
      createdAt: now,
    };
  }

  async findLatestByTaskId(taskId: string): Promise<Checkpoint | undefined> {
    const result = this.db.getSqlite().prepare(`
      SELECT id, task_id, phase, progress, state, created_at
      FROM checkpoints WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(taskId) as {
      id: string;
      task_id: string;
      phase: CheckpointPhase;
      progress: string;
      state: string;
      created_at: string;
    } | undefined;

    if (!result) return undefined;

    return {
      id: result.id,
      taskId: result.task_id,
      phase: result.phase,
      progress: JSON.parse(result.progress),
      state: JSON.parse(result.state),
      createdAt: result.created_at,
    };
  }

  async findAllByTaskId(taskId: string): Promise<Checkpoint[]> {
    const results = this.db.getSqlite().prepare(`
      SELECT id, task_id, phase, progress, state, created_at
      FROM checkpoints WHERE task_id = ? ORDER BY created_at ASC
    `).all(taskId) as Array<{
      id: string;
      task_id: string;
      phase: CheckpointPhase;
      progress: string;
      state: string;
      created_at: string;
    }>;

    return results.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      phase: r.phase,
      progress: JSON.parse(r.progress),
      state: JSON.parse(r.state),
      createdAt: r.created_at,
    }));
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    this.db.getSqlite().prepare(`
      DELETE FROM checkpoints WHERE task_id = ?
    `).run(taskId);
  }
}
