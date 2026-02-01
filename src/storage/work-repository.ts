import type { DatabaseConnection } from './database.js';

export interface Work {
  id: string;
  soulId: string;
  title: string;
  content: string;
  totalChapters: number;
  totalTokens: number;
  complianceScore: number | null;
  readerScore: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkInput {
  soulId: string;
  title: string;
  content: string;
  totalChapters: number;
  totalTokens: number;
  complianceScore?: number;
  readerScore?: number;
  status?: string;
}

export interface UpdateWorkInput {
  title?: string;
  content?: string;
  complianceScore?: number;
  readerScore?: number;
  status?: string;
}

/**
 * Repository for managing works in the database
 */
export class WorkRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async create(input: CreateWorkInput): Promise<Work> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.getSqlite().prepare(`
      INSERT INTO works (id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.soulId,
      input.title,
      input.content,
      input.totalChapters,
      input.totalTokens,
      input.complianceScore ?? null,
      input.readerScore ?? null,
      input.status ?? 'completed',
      now,
      now
    );

    return {
      id,
      soulId: input.soulId,
      title: input.title,
      content: input.content,
      totalChapters: input.totalChapters,
      totalTokens: input.totalTokens,
      complianceScore: input.complianceScore ?? null,
      readerScore: input.readerScore ?? null,
      status: input.status ?? 'completed',
      createdAt: now,
      updatedAt: now,
    };
  }

  async findById(id: string): Promise<Work | undefined> {
    const result = this.db.getSqlite().prepare(`
      SELECT id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, status, created_at, updated_at
      FROM works WHERE id = ?
    `).get(id) as {
      id: string;
      soul_id: string;
      title: string;
      content: string;
      total_chapters: number;
      total_tokens: number;
      compliance_score: number | null;
      reader_score: number | null;
      status: string;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!result) return undefined;

    return {
      id: result.id,
      soulId: result.soul_id,
      title: result.title,
      content: result.content,
      totalChapters: result.total_chapters,
      totalTokens: result.total_tokens,
      complianceScore: result.compliance_score,
      readerScore: result.reader_score,
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  async findBySoulId(soulId: string): Promise<Work[]> {
    const results = this.db.getSqlite().prepare(`
      SELECT id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, status, created_at, updated_at
      FROM works WHERE soul_id = ?
    `).all(soulId) as Array<{
      id: string;
      soul_id: string;
      title: string;
      content: string;
      total_chapters: number;
      total_tokens: number;
      compliance_score: number | null;
      reader_score: number | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>;

    return results.map((r) => ({
      id: r.id,
      soulId: r.soul_id,
      title: r.title,
      content: r.content,
      totalChapters: r.total_chapters,
      totalTokens: r.total_tokens,
      complianceScore: r.compliance_score,
      readerScore: r.reader_score,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async findRecentBySoulId(soulId: string, limit: number): Promise<Work[]> {
    const results = this.db.getSqlite().prepare(`
      SELECT id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, status, created_at, updated_at
      FROM works WHERE soul_id = ? AND status = 'completed'
      ORDER BY created_at DESC LIMIT ?
    `).all(soulId, limit) as Array<{
      id: string;
      soul_id: string;
      title: string;
      content: string;
      total_chapters: number;
      total_tokens: number;
      compliance_score: number | null;
      reader_score: number | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>;

    return results.map((r) => ({
      id: r.id,
      soulId: r.soul_id,
      title: r.title,
      content: r.content,
      totalChapters: r.total_chapters,
      totalTokens: r.total_tokens,
      complianceScore: r.compliance_score,
      readerScore: r.reader_score,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async update(id: string, input: UpdateWorkInput): Promise<Work | undefined> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(input.content);
    }
    if (input.complianceScore !== undefined) {
      updates.push('compliance_score = ?');
      values.push(input.complianceScore);
    }
    if (input.readerScore !== undefined) {
      updates.push('reader_score = ?');
      values.push(input.readerScore);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db.getSqlite().prepare(`
      UPDATE works SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    this.db.getSqlite().prepare('DELETE FROM works WHERE id = ?').run(id);
  }
}
