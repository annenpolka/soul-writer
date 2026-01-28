import type { DatabaseConnection } from './database.js';

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

/**
 * Repository for managing tasks in the database
 */
export class TaskRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const paramsJson = JSON.stringify(input.params);

    this.db.getSqlite().prepare(`
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
  }

  async findById(id: string): Promise<Task | undefined> {
    const result = this.db.getSqlite().prepare(`
      SELECT id, soul_id, status, params, error, created_at, started_at, completed_at
      FROM tasks WHERE id = ?
    `).get(id) as {
      id: string;
      soul_id: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      params: string;
      error: string | null;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
    } | undefined;

    if (!result) return undefined;

    return {
      id: result.id,
      soulId: result.soul_id,
      status: result.status,
      params: JSON.parse(result.params),
      error: result.error,
      createdAt: result.created_at,
      startedAt: result.started_at,
      completedAt: result.completed_at,
    };
  }

  async findPending(): Promise<Task[]> {
    const results = this.db.getSqlite().prepare(`
      SELECT id, soul_id, status, params, error, created_at, started_at, completed_at
      FROM tasks WHERE status = 'pending' ORDER BY created_at ASC
    `).all() as Array<{
      id: string;
      soul_id: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      params: string;
      error: string | null;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
    }>;

    return results.map((r) => ({
      id: r.id,
      soulId: r.soul_id,
      status: r.status,
      params: JSON.parse(r.params),
      error: r.error,
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    }));
  }

  async markStarted(id: string): Promise<Task | undefined> {
    const now = new Date().toISOString();

    this.db.getSqlite().prepare(`
      UPDATE tasks SET status = 'running', started_at = ? WHERE id = ?
    `).run(now, id);

    return this.findById(id);
  }

  async markCompleted(id: string): Promise<Task | undefined> {
    const now = new Date().toISOString();

    this.db.getSqlite().prepare(`
      UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?
    `).run(now, id);

    return this.findById(id);
  }

  async markFailed(id: string, error: string): Promise<Task | undefined> {
    const now = new Date().toISOString();

    this.db.getSqlite().prepare(`
      UPDATE tasks SET status = 'failed', error = ?, completed_at = ? WHERE id = ?
    `).run(error, now, id);

    return this.findById(id);
  }
}
