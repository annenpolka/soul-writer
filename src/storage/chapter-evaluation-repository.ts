import type Database from 'better-sqlite3';

export interface ChapterEvaluation {
  id: string;
  chapterId: string | null;
  verdictLevel: string;
  defects: unknown[];
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  feedback: string;
  createdAt: string;
}

export interface SaveChapterEvalInput {
  chapterId: string | null;
  verdictLevel: string;
  defects: unknown[];
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  feedback: string;
}

type ChapterEvalRow = {
  id: string;
  chapter_id: string | null;
  verdict_level: string;
  defects_json: string;
  critical_count: number;
  major_count: number;
  minor_count: number;
  feedback: string;
  created_at: string;
};

function rowToEval(r: ChapterEvalRow): ChapterEvaluation {
  return {
    id: r.id,
    chapterId: r.chapter_id,
    verdictLevel: r.verdict_level,
    defects: JSON.parse(r.defects_json),
    criticalCount: r.critical_count,
    majorCount: r.major_count,
    minorCount: r.minor_count,
    feedback: r.feedback,
    createdAt: r.created_at,
  };
}

export interface ChapterEvalRepo {
  save: (input: SaveChapterEvalInput) => Promise<ChapterEvaluation>;
  findByChapterId: (chapterId: string) => Promise<ChapterEvaluation[]>;
  findByWorkId: (workId: string) => Promise<ChapterEvaluation[]>;
}

export function createChapterEvalRepo(sqlite: Database.Database): ChapterEvalRepo {
  return {
    save: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`
        INSERT INTO chapter_evaluations (id, chapter_id, verdict_level, defects_json, critical_count, major_count, minor_count, feedback, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.chapterId,
        input.verdictLevel,
        JSON.stringify(input.defects),
        input.criticalCount,
        input.majorCount,
        input.minorCount,
        input.feedback,
        now
      );

      return {
        id,
        chapterId: input.chapterId,
        verdictLevel: input.verdictLevel,
        defects: input.defects,
        criticalCount: input.criticalCount,
        majorCount: input.majorCount,
        minorCount: input.minorCount,
        feedback: input.feedback,
        createdAt: now,
      };
    },

    findByChapterId: async (chapterId) => {
      const results = sqlite.prepare(`
        SELECT id, chapter_id, verdict_level, defects_json, critical_count, major_count, minor_count, feedback, created_at
        FROM chapter_evaluations WHERE chapter_id = ? ORDER BY created_at ASC
      `).all(chapterId) as ChapterEvalRow[];

      return results.map(rowToEval);
    },

    findByWorkId: async (workId) => {
      const results = sqlite.prepare(`
        SELECT ce.id, ce.chapter_id, ce.verdict_level, ce.defects_json, ce.critical_count, ce.major_count, ce.minor_count, ce.feedback, ce.created_at
        FROM chapter_evaluations ce
        JOIN chapters c ON ce.chapter_id = c.id
        WHERE c.work_id = ?
        ORDER BY c.chapter_index ASC, ce.created_at ASC
      `).all(workId) as ChapterEvalRow[];

      return results.map(rowToEval);
    },
  };
}
