import type Database from 'better-sqlite3';

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

type CheckpointRow = {
  id: string;
  task_id: string;
  phase: CheckpointPhase;
  progress: string;
  state: string;
  created_at: string;
};

function rowToCheckpoint(r: CheckpointRow): Checkpoint {
  return {
    id: r.id,
    taskId: r.task_id,
    phase: r.phase,
    progress: JSON.parse(r.progress),
    state: JSON.parse(r.state),
    createdAt: r.created_at,
  };
}

export interface CheckpointRepo {
  create: (input: CreateCheckpointInput) => Promise<Checkpoint>;
  findLatestByTaskId: (taskId: string) => Promise<Checkpoint | undefined>;
  findAllByTaskId: (taskId: string) => Promise<Checkpoint[]>;
  deleteByTaskId: (taskId: string) => Promise<void>;
}

export function createCheckpointRepo(sqlite: Database.Database): CheckpointRepo {
  return {
    create: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const progressJson = JSON.stringify(input.progress);
      const stateJson = JSON.stringify(input.state);

      sqlite.prepare(`
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
    },

    findLatestByTaskId: async (taskId) => {
      const result = sqlite.prepare(`
        SELECT id, task_id, phase, progress, state, created_at
        FROM checkpoints WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(taskId) as CheckpointRow | undefined;

      if (!result) return undefined;
      return rowToCheckpoint(result);
    },

    findAllByTaskId: async (taskId) => {
      const results = sqlite.prepare(`
        SELECT id, task_id, phase, progress, state, created_at
        FROM checkpoints WHERE task_id = ? ORDER BY created_at ASC
      `).all(taskId) as CheckpointRow[];

      return results.map(rowToCheckpoint);
    },

    deleteByTaskId: async (taskId) => {
      sqlite.prepare(`
        DELETE FROM checkpoints WHERE task_id = ?
      `).run(taskId);
    },
  };
}

