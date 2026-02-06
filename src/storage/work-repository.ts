import type Database from 'better-sqlite3';

export interface Work {
  id: string;
  soulId: string;
  title: string;
  content: string;
  totalChapters: number;
  totalTokens: number;
  complianceScore: number | null;
  readerScore: number | null;
  tone: string | null;
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
  tone?: string;
  status?: string;
}

export interface UpdateWorkInput {
  title?: string;
  content?: string;
  complianceScore?: number;
  readerScore?: number;
  status?: string;
}

type WorkRow = {
  id: string;
  soul_id: string;
  title: string;
  content: string;
  total_chapters: number;
  total_tokens: number;
  compliance_score: number | null;
  reader_score: number | null;
  tone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function rowToWork(r: WorkRow): Work {
  return {
    id: r.id,
    soulId: r.soul_id,
    title: r.title,
    content: r.content,
    totalChapters: r.total_chapters,
    totalTokens: r.total_tokens,
    complianceScore: r.compliance_score,
    readerScore: r.reader_score,
    tone: r.tone,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface WorkRepo {
  create: (input: CreateWorkInput) => Promise<Work>;
  findById: (id: string) => Promise<Work | undefined>;
  findBySoulId: (soulId: string) => Promise<Work[]>;
  findRecentBySoulId: (soulId: string, limit: number) => Promise<Work[]>;
  update: (id: string, input: UpdateWorkInput) => Promise<Work | undefined>;
  delete: (id: string) => Promise<void>;
}

export function createWorkRepo(sqlite: Database.Database): WorkRepo {
  return {
    create: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`
        INSERT INTO works (id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, tone, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.soulId,
        input.title,
        input.content,
        input.totalChapters,
        input.totalTokens,
        input.complianceScore ?? null,
        input.readerScore ?? null,
        input.tone ?? null,
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
        tone: input.tone ?? null,
        status: input.status ?? 'completed',
        createdAt: now,
        updatedAt: now,
      };
    },

    findById: async (id) => {
      const result = sqlite.prepare(`
        SELECT id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, tone, status, created_at, updated_at
        FROM works WHERE id = ?
      `).get(id) as WorkRow | undefined;

      if (!result) return undefined;
      return rowToWork(result);
    },

    findBySoulId: async (soulId) => {
      const results = sqlite.prepare(`
        SELECT id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, tone, status, created_at, updated_at
        FROM works WHERE soul_id = ?
      `).all(soulId) as WorkRow[];

      return results.map(rowToWork);
    },

    findRecentBySoulId: async (soulId, limit) => {
      const results = sqlite.prepare(`
        SELECT id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, tone, status, created_at, updated_at
        FROM works WHERE soul_id = ? AND status = 'completed'
        ORDER BY created_at DESC LIMIT ?
      `).all(soulId, limit) as WorkRow[];

      return results.map(rowToWork);
    },

    update: async (id, input) => {
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

      sqlite.prepare(`
        UPDATE works SET ${updates.join(', ')} WHERE id = ?
      `).run(...values);

      const result = sqlite.prepare(`
        SELECT id, soul_id, title, content, total_chapters, total_tokens, compliance_score, reader_score, tone, status, created_at, updated_at
        FROM works WHERE id = ?
      `).get(id) as WorkRow | undefined;

      if (!result) return undefined;
      return rowToWork(result);
    },

    delete: async (id) => {
      sqlite.prepare('DELETE FROM works WHERE id = ?').run(id);
    },
  };
}

