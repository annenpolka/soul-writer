import type Database from 'better-sqlite3';

export interface Task {
  id: string;
  soulId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateTaskInput {
  soulId: string;
  params: Record<string, unknown>;
}

type TaskRow = {
  id: string;
  soul_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: string;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    soulId: r.soul_id,
    status: r.status,
    params: JSON.parse(r.params),
    error: r.error,
    createdAt: r.created_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  };
}

export interface TaskRepo {
  create: (input: CreateTaskInput) => Promise<Task>;
  findById: (id: string) => Promise<Task | undefined>;
  findPending: () => Promise<Task[]>;
  markStarted: (id: string) => Promise<Task | undefined>;
  markCompleted: (id: string) => Promise<Task | undefined>;
  markFailed: (id: string, error: string) => Promise<Task | undefined>;
}

export function createTaskRepo(sqlite: Database.Database): TaskRepo {
  const findById = async (id: string): Promise<Task | undefined> => {
    const result = sqlite.prepare(`
      SELECT id, soul_id, status, params, error, created_at, started_at, completed_at
      FROM tasks WHERE id = ?
    `).get(id) as TaskRow | undefined;

    if (!result) return undefined;
    return rowToTask(result);
  };

  return {
    create: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const paramsJson = JSON.stringify(input.params);

      sqlite.prepare(`
        INSERT INTO tasks (id, soul_id, status, params, created_at)
        VALUES (?, ?, 'pending', ?, ?)
      `).run(id, input.soulId, paramsJson, now);

      return {
        id,
        soulId: input.soulId,
        status: 'pending',
        params: input.params,
        error: null,
        createdAt: now,
        startedAt: null,
        completedAt: null,
      };
    },

    findById,

    findPending: async () => {
      const results = sqlite.prepare(`
        SELECT id, soul_id, status, params, error, created_at, started_at, completed_at
        FROM tasks WHERE status = 'pending' ORDER BY created_at ASC
      `).all() as TaskRow[];

      return results.map(rowToTask);
    },

    markStarted: async (id) => {
      const now = new Date().toISOString();
      sqlite.prepare(`
        UPDATE tasks SET status = 'running', started_at = ? WHERE id = ?
      `).run(now, id);
      return findById(id);
    },

    markCompleted: async (id) => {
      const now = new Date().toISOString();
      sqlite.prepare(`
        UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?
      `).run(now, id);
      return findById(id);
    },

    markFailed: async (id, error) => {
      const now = new Date().toISOString();
      sqlite.prepare(`
        UPDATE tasks SET status = 'failed', error = ?, completed_at = ? WHERE id = ?
      `).run(error, now, id);
      return findById(id);
    },
  };
}

