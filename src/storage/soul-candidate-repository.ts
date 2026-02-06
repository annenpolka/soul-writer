import type Database from 'better-sqlite3';

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

type SoulCandidateRow = {
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
};

function rowToSoulCandidate(r: SoulCandidateRow): SoulCandidate {
  return {
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
  };
}

export interface SoulCandidateRepo {
  create: (input: CreateSoulCandidateInput) => Promise<SoulCandidate>;
  findById: (id: string) => Promise<SoulCandidate | undefined>;
  findPendingBySoulId: (soulId: string) => Promise<SoulCandidate[]>;
  findApprovedBySoulId: (soulId: string) => Promise<SoulCandidate[]>;
  approve: (id: string, notes?: string) => Promise<SoulCandidate | undefined>;
  reject: (id: string, notes?: string) => Promise<SoulCandidate | undefined>;
  countByStatus: (soulId: string) => Promise<{ pending: number; approved: number; rejected: number }>;
}

export function createSoulCandidateRepo(sqlite: Database.Database): SoulCandidateRepo {
  const findById = async (id: string): Promise<SoulCandidate | undefined> => {
    const result = sqlite.prepare(`
      SELECT id, soul_id, source_work_id, source_chapter_id, fragment_text, suggested_category, auto_score, status, reviewer_notes, created_at, reviewed_at
      FROM soul_candidates WHERE id = ?
    `).get(id) as SoulCandidateRow | undefined;

    if (!result) return undefined;
    return rowToSoulCandidate(result);
  };

  return {
    create: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`
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
    },

    findById,

    findPendingBySoulId: async (soulId) => {
      const results = sqlite.prepare(`
        SELECT id, soul_id, source_work_id, source_chapter_id, fragment_text, suggested_category, auto_score, status, reviewer_notes, created_at, reviewed_at
        FROM soul_candidates WHERE soul_id = ? AND status = 'pending' ORDER BY created_at ASC
      `).all(soulId) as SoulCandidateRow[];

      return results.map(rowToSoulCandidate);
    },

    findApprovedBySoulId: async (soulId) => {
      const results = sqlite.prepare(`
        SELECT id, soul_id, source_work_id, source_chapter_id, fragment_text, suggested_category, auto_score, status, reviewer_notes, created_at, reviewed_at
        FROM soul_candidates WHERE soul_id = ? AND status = 'approved' ORDER BY created_at ASC
      `).all(soulId) as SoulCandidateRow[];

      return results.map(rowToSoulCandidate);
    },

    approve: async (id, notes?) => {
      const now = new Date().toISOString();
      sqlite.prepare(`
        UPDATE soul_candidates SET status = 'approved', reviewer_notes = ?, reviewed_at = ? WHERE id = ?
      `).run(notes ?? null, now, id);
      return findById(id);
    },

    reject: async (id, notes?) => {
      const now = new Date().toISOString();
      sqlite.prepare(`
        UPDATE soul_candidates SET status = 'rejected', reviewer_notes = ?, reviewed_at = ? WHERE id = ?
      `).run(notes ?? null, now, id);
      return findById(id);
    },

    countByStatus: async (soulId) => {
      const result = sqlite.prepare(`
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
    },
  };
}

