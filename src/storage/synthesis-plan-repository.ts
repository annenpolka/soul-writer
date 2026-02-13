import type Database from 'better-sqlite3';

export interface SynthesisPlanResult {
  id: string;
  chapterId: string | null;
  championAssessment: string;
  preserveElements: unknown[];
  actions: unknown[];
  expressionSources: unknown[];
  createdAt: string;
}

export interface SaveSynthesisPlanInput {
  chapterId: string | null;
  championAssessment: string;
  preserveElements: unknown[];
  actions: unknown[];
  expressionSources: unknown[];
}

type SynthesisPlanRow = {
  id: string;
  chapter_id: string | null;
  champion_assessment: string;
  preserve_elements_json: string;
  actions_json: string;
  expression_sources_json: string;
  created_at: string;
};

function rowToPlan(r: SynthesisPlanRow): SynthesisPlanResult {
  return {
    id: r.id,
    chapterId: r.chapter_id,
    championAssessment: r.champion_assessment,
    preserveElements: JSON.parse(r.preserve_elements_json),
    actions: JSON.parse(r.actions_json),
    expressionSources: JSON.parse(r.expression_sources_json),
    createdAt: r.created_at,
  };
}

export interface SynthesisPlanRepo {
  save: (input: SaveSynthesisPlanInput) => Promise<SynthesisPlanResult>;
  findByChapterId: (chapterId: string) => Promise<SynthesisPlanResult | undefined>;
}

export function createSynthesisPlanRepo(sqlite: Database.Database): SynthesisPlanRepo {
  return {
    save: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`
        INSERT INTO synthesis_plans (id, chapter_id, champion_assessment, preserve_elements_json, actions_json, expression_sources_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.chapterId,
        input.championAssessment,
        JSON.stringify(input.preserveElements),
        JSON.stringify(input.actions),
        JSON.stringify(input.expressionSources),
        now
      );

      return {
        id,
        chapterId: input.chapterId,
        championAssessment: input.championAssessment,
        preserveElements: input.preserveElements,
        actions: input.actions,
        expressionSources: input.expressionSources,
        createdAt: now,
      };
    },

    findByChapterId: async (chapterId) => {
      const result = sqlite.prepare(`
        SELECT id, chapter_id, champion_assessment, preserve_elements_json, actions_json, expression_sources_json, created_at
        FROM synthesis_plans WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(chapterId) as SynthesisPlanRow | undefined;

      if (!result) return undefined;
      return rowToPlan(result);
    },
  };
}
