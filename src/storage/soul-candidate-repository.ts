import type { DatabaseConnection } from './database.js';

export interface SoulCandidate {
  id: string;
  soulId: string;
  sourceWorkId: string;
  sourceChapterId: string | null;
  fragmentText: string;
  suggestedCategory: string;
  autoScore: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewerNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface CreateSoulCandidateInput {
  soulId: string;
  sourceWorkId: string;
  sourceChapterId?: string;
  fragmentText: string;
  suggestedCategory: string;
  autoScore: number;
}

/**
 * Repository for managing soul candidates in the database
 */
export class SoulCandidateRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async create(input: CreateSoulCandidateInput): Promise<SoulCandidate> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.getSqlite().prepare(`
      INSERT INTO soul_candidates (id, soul_id, source_work_id, source_chapter_id, fragment_text, suggested_category, auto_score, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      id,
      input.soulId,
      input.sourceWorkId,
      input.sourceChapterId ?? null,
      input.fragmentText,
      input.suggestedCategory,
      input.autoScore,
      now
    );

    return {
      id,
      soulId: input.soulId,
      sourceWorkId: input.sourceWorkId,
      sourceChapterId: input.sourceChapterId ?? null,
      fragmentText: input.fragmentText,
      suggestedCategory: input.suggestedCategory,
      autoScore: input.autoScore,
      status: 'pending',
      reviewerNotes: null,
      createdAt: now,
      reviewedAt: null,
    };
  }

  async findById(id: string): Promise<SoulCandidate | undefined> {
    const result = this.db.getSqlite().prepare(`
      SELECT id, soul_id, source_work_id, source_chapter_id, fragment_text, suggested_category, auto_score, status, reviewer_notes, created_at, reviewed_at
      FROM soul_candidates WHERE id = ?
    `).get(id) as {
      id: string;
      soul_id: string;
      source_work_id: string;
      source_chapter_id: string | null;
      fragment_text: string;
      suggested_category: string;
      auto_score: number;
      status: 'pending' | 'approved' | 'rejected';
      reviewer_notes: string | null;
      created_at: string;
      reviewed_at: string | null;
    } | undefined;

    if (!result) return undefined;

    return {
      id: result.id,
      soulId: result.soul_id,
      sourceWorkId: result.source_work_id,
      sourceChapterId: result.source_chapter_id,
      fragmentText: result.fragment_text,
      suggestedCategory: result.suggested_category,
      autoScore: result.auto_score,
      status: result.status,
      reviewerNotes: result.reviewer_notes,
      createdAt: result.created_at,
      reviewedAt: result.reviewed_at,
    };
  }

  async findPendingBySoulId(soulId: string): Promise<SoulCandidate[]> {
    const results = this.db.getSqlite().prepare(`
      SELECT id, soul_id, source_work_id, source_chapter_id, fragment_text, suggested_category, auto_score, status, reviewer_notes, created_at, reviewed_at
      FROM soul_candidates WHERE soul_id = ? AND status = 'pending' ORDER BY created_at ASC
    `).all(soulId) as Array<{
      id: string;
      soul_id: string;
      source_work_id: string;
      source_chapter_id: string | null;
      fragment_text: string;
      suggested_category: string;
      auto_score: number;
      status: 'pending' | 'approved' | 'rejected';
      reviewer_notes: string | null;
      created_at: string;
      reviewed_at: string | null;
    }>;

    return results.map((r) => ({
      id: r.id,
      soulId: r.soul_id,
      sourceWorkId: r.source_work_id,
      sourceChapterId: r.source_chapter_id,
      fragmentText: r.fragment_text,
      suggestedCategory: r.suggested_category,
      autoScore: r.auto_score,
      status: r.status,
      reviewerNotes: r.reviewer_notes,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }));
  }

  async findApprovedBySoulId(soulId: string): Promise<SoulCandidate[]> {
    const results = this.db.getSqlite().prepare(`
      SELECT id, soul_id, source_work_id, source_chapter_id, fragment_text, suggested_category, auto_score, status, reviewer_notes, created_at, reviewed_at
      FROM soul_candidates WHERE soul_id = ? AND status = 'approved' ORDER BY created_at ASC
    `).all(soulId) as Array<{
      id: string;
      soul_id: string;
      source_work_id: string;
      source_chapter_id: string | null;
      fragment_text: string;
      suggested_category: string;
      auto_score: number;
      status: 'pending' | 'approved' | 'rejected';
      reviewer_notes: string | null;
      created_at: string;
      reviewed_at: string | null;
    }>;

    return results.map((r) => ({
      id: r.id,
      soulId: r.soul_id,
      sourceWorkId: r.source_work_id,
      sourceChapterId: r.source_chapter_id,
      fragmentText: r.fragment_text,
      suggestedCategory: r.suggested_category,
      autoScore: r.auto_score,
      status: r.status,
      reviewerNotes: r.reviewer_notes,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }));
  }

  async approve(id: string, notes?: string): Promise<SoulCandidate | undefined> {
    const now = new Date().toISOString();

    this.db.getSqlite().prepare(`
      UPDATE soul_candidates SET status = 'approved', reviewer_notes = ?, reviewed_at = ? WHERE id = ?
    `).run(notes ?? null, now, id);

    return this.findById(id);
  }

  async reject(id: string, notes?: string): Promise<SoulCandidate | undefined> {
    const now = new Date().toISOString();

    this.db.getSqlite().prepare(`
      UPDATE soul_candidates SET status = 'rejected', reviewer_notes = ?, reviewed_at = ? WHERE id = ?
    `).run(notes ?? null, now, id);

    return this.findById(id);
  }

  async countByStatus(soulId: string): Promise<{ pending: number; approved: number; rejected: number }> {
    const result = this.db.getSqlite().prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM soul_candidates WHERE soul_id = ?
    `).get(soulId) as { pending: number; approved: number; rejected: number } | undefined;

    return {
      pending: result?.pending ?? 0,
      approved: result?.approved ?? 0,
      rejected: result?.rejected ?? 0,
    };
  }
}
