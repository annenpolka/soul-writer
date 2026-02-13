import type Database from 'better-sqlite3';

export interface JudgeSessionResult {
  id: string;
  matchId: string | null;
  scores: Record<string, unknown>;
  axisComments: Record<string, unknown>;
  weaknesses: unknown[];
  sectionAnalysis: unknown[];
  praisedExcerpts: string[];
  createdAt: string;
}

export interface SaveJudgeSessionInput {
  matchId: string | null;
  scores: Record<string, unknown>;
  axisComments: Record<string, unknown>;
  weaknesses: unknown[];
  sectionAnalysis: unknown[];
  praisedExcerpts: string[];
}

type JudgeSessionRow = {
  id: string;
  match_id: string | null;
  scores_json: string;
  axis_comments_json: string;
  weaknesses_json: string;
  section_analysis_json: string;
  praised_excerpts_json: string;
  created_at: string;
};

function rowToResult(r: JudgeSessionRow): JudgeSessionResult {
  return {
    id: r.id,
    matchId: r.match_id,
    scores: JSON.parse(r.scores_json),
    axisComments: JSON.parse(r.axis_comments_json),
    weaknesses: JSON.parse(r.weaknesses_json),
    sectionAnalysis: JSON.parse(r.section_analysis_json),
    praisedExcerpts: JSON.parse(r.praised_excerpts_json),
    createdAt: r.created_at,
  };
}

export interface JudgeSessionRepo {
  save: (input: SaveJudgeSessionInput) => Promise<JudgeSessionResult>;
  findByMatchId: (matchId: string) => Promise<JudgeSessionResult | undefined>;
}

export function createJudgeSessionRepo(sqlite: Database.Database): JudgeSessionRepo {
  return {
    save: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`
        INSERT INTO judge_session_results (id, match_id, scores_json, axis_comments_json, weaknesses_json, section_analysis_json, praised_excerpts_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.matchId,
        JSON.stringify(input.scores),
        JSON.stringify(input.axisComments),
        JSON.stringify(input.weaknesses),
        JSON.stringify(input.sectionAnalysis),
        JSON.stringify(input.praisedExcerpts),
        now
      );

      return {
        id,
        matchId: input.matchId,
        scores: input.scores,
        axisComments: input.axisComments,
        weaknesses: input.weaknesses,
        sectionAnalysis: input.sectionAnalysis,
        praisedExcerpts: input.praisedExcerpts,
        createdAt: now,
      };
    },

    findByMatchId: async (matchId) => {
      const result = sqlite.prepare(`
        SELECT id, match_id, scores_json, axis_comments_json, weaknesses_json, section_analysis_json, praised_excerpts_json, created_at
        FROM judge_session_results WHERE match_id = ?
      `).get(matchId) as JudgeSessionRow | undefined;

      if (!result) return undefined;
      return rowToResult(result);
    },
  };
}
