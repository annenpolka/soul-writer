import type Database from 'better-sqlite3';

export interface PhaseMetric {
  id: string;
  workId: string | null;
  chapterIndex: number;
  phase: string;
  durationMs: number;
  tokensUsed: number;
  createdAt: string;
}

export interface SavePhaseMetricInput {
  workId: string | null;
  chapterIndex: number;
  phase: string;
  durationMs: number;
  tokensUsed: number;
}

type PhaseMetricRow = {
  id: string;
  work_id: string | null;
  chapter_index: number;
  phase: string;
  duration_ms: number;
  tokens_used: number;
  created_at: string;
};

function rowToMetric(r: PhaseMetricRow): PhaseMetric {
  return {
    id: r.id,
    workId: r.work_id,
    chapterIndex: r.chapter_index,
    phase: r.phase,
    durationMs: r.duration_ms,
    tokensUsed: r.tokens_used,
    createdAt: r.created_at,
  };
}

export interface PhaseMetricsRepo {
  save: (input: SavePhaseMetricInput) => Promise<PhaseMetric>;
  findByWorkId: (workId: string) => Promise<PhaseMetric[]>;
  findByWorkIdAndChapter: (workId: string, chapterIndex: number) => Promise<PhaseMetric[]>;
}

export function createPhaseMetricsRepo(sqlite: Database.Database): PhaseMetricsRepo {
  return {
    save: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`
        INSERT INTO phase_metrics (id, work_id, chapter_index, phase, duration_ms, tokens_used, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.workId,
        input.chapterIndex,
        input.phase,
        input.durationMs,
        input.tokensUsed,
        now
      );

      return {
        id,
        workId: input.workId,
        chapterIndex: input.chapterIndex,
        phase: input.phase,
        durationMs: input.durationMs,
        tokensUsed: input.tokensUsed,
        createdAt: now,
      };
    },

    findByWorkId: async (workId) => {
      const results = sqlite.prepare(`
        SELECT id, work_id, chapter_index, phase, duration_ms, tokens_used, created_at
        FROM phase_metrics WHERE work_id = ? ORDER BY chapter_index ASC, created_at ASC
      `).all(workId) as PhaseMetricRow[];

      return results.map(rowToMetric);
    },

    findByWorkIdAndChapter: async (workId, chapterIndex) => {
      const results = sqlite.prepare(`
        SELECT id, work_id, chapter_index, phase, duration_ms, tokens_used, created_at
        FROM phase_metrics WHERE work_id = ? AND chapter_index = ? ORDER BY created_at ASC
      `).all(workId, chapterIndex) as PhaseMetricRow[];

      return results.map(rowToMetric);
    },
  };
}
