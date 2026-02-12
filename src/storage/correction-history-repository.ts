import type Database from 'better-sqlite3';

export interface CorrectionHistoryEntry {
  id: string;
  chapterId: string | null;
  attemptNumber: number;
  violationsCount: number;
  correctedSuccessfully: boolean;
  tokensUsed: number;
  createdAt: string;
}

export interface SaveCorrectionHistoryInput {
  chapterId: string | null;
  attemptNumber: number;
  violationsCount: number;
  correctedSuccessfully: boolean;
  tokensUsed: number;
}

type CorrectionHistoryRow = {
  id: string;
  chapter_id: string | null;
  attempt_number: number;
  violations_count: number;
  corrected_successfully: number; // 0/1
  tokens_used: number;
  created_at: string;
};

function rowToEntry(r: CorrectionHistoryRow): CorrectionHistoryEntry {
  return {
    id: r.id,
    chapterId: r.chapter_id,
    attemptNumber: r.attempt_number,
    violationsCount: r.violations_count,
    correctedSuccessfully: r.corrected_successfully === 1,
    tokensUsed: r.tokens_used,
    createdAt: r.created_at,
  };
}

export interface CorrectionHistoryRepo {
  save: (input: SaveCorrectionHistoryInput) => Promise<CorrectionHistoryEntry>;
  findByChapterId: (chapterId: string) => Promise<CorrectionHistoryEntry[]>;
}

export function createCorrectionHistoryRepo(sqlite: Database.Database): CorrectionHistoryRepo {
  return {
    save: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`
        INSERT INTO correction_history (id, chapter_id, attempt_number, violations_count, corrected_successfully, tokens_used, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.chapterId,
        input.attemptNumber,
        input.violationsCount,
        input.correctedSuccessfully ? 1 : 0,
        input.tokensUsed,
        now
      );

      return {
        id,
        chapterId: input.chapterId,
        attemptNumber: input.attemptNumber,
        violationsCount: input.violationsCount,
        correctedSuccessfully: input.correctedSuccessfully,
        tokensUsed: input.tokensUsed,
        createdAt: now,
      };
    },

    findByChapterId: async (chapterId) => {
      const results = sqlite.prepare(`
        SELECT id, chapter_id, attempt_number, violations_count, corrected_successfully, tokens_used, created_at
        FROM correction_history WHERE chapter_id = ? ORDER BY attempt_number ASC
      `).all(chapterId) as CorrectionHistoryRow[];

      return results.map(rowToEntry);
    },
  };
}
