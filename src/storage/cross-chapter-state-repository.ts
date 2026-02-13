import type Database from 'better-sqlite3';

export interface CrossChapterState {
  id: string;
  workId: string | null;
  chapterIndex: number;
  characterStates: Record<string, unknown>;
  motifWear: Record<string, unknown>;
  variationHint: string;
  chapterSummary: string;
  dominantTone: string;
  peakIntensity: number;
  createdAt: string;
}

export interface SaveCrossChapterStateInput {
  workId: string | null;
  chapterIndex: number;
  characterStates: Record<string, unknown>;
  motifWear: Record<string, unknown>;
  variationHint: string;
  chapterSummary: string;
  dominantTone: string;
  peakIntensity: number;
}

type CrossChapterStateRow = {
  id: string;
  work_id: string | null;
  chapter_index: number;
  character_states_json: string;
  motif_wear_json: string;
  variation_hint: string;
  chapter_summary: string;
  dominant_tone: string;
  peak_intensity: number;
  created_at: string;
};

function rowToState(r: CrossChapterStateRow): CrossChapterState {
  return {
    id: r.id,
    workId: r.work_id,
    chapterIndex: r.chapter_index,
    characterStates: JSON.parse(r.character_states_json),
    motifWear: JSON.parse(r.motif_wear_json),
    variationHint: r.variation_hint,
    chapterSummary: r.chapter_summary,
    dominantTone: r.dominant_tone,
    peakIntensity: r.peak_intensity,
    createdAt: r.created_at,
  };
}

export interface CrossChapterStateRepo {
  save: (input: SaveCrossChapterStateInput) => Promise<CrossChapterState>;
  findByWorkId: (workId: string) => Promise<CrossChapterState[]>;
  findByWorkIdAndChapter: (workId: string, chapterIndex: number) => Promise<CrossChapterState | undefined>;
}

export function createCrossChapterStateRepo(sqlite: Database.Database): CrossChapterStateRepo {
  return {
    save: async (input) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`
        INSERT INTO cross_chapter_states (id, work_id, chapter_index, character_states_json, motif_wear_json, variation_hint, chapter_summary, dominant_tone, peak_intensity, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.workId,
        input.chapterIndex,
        JSON.stringify(input.characterStates),
        JSON.stringify(input.motifWear),
        input.variationHint,
        input.chapterSummary,
        input.dominantTone,
        input.peakIntensity,
        now
      );

      return {
        id,
        workId: input.workId,
        chapterIndex: input.chapterIndex,
        characterStates: input.characterStates,
        motifWear: input.motifWear,
        variationHint: input.variationHint,
        chapterSummary: input.chapterSummary,
        dominantTone: input.dominantTone,
        peakIntensity: input.peakIntensity,
        createdAt: now,
      };
    },

    findByWorkId: async (workId) => {
      const results = sqlite.prepare(`
        SELECT id, work_id, chapter_index, character_states_json, motif_wear_json, variation_hint, chapter_summary, dominant_tone, peak_intensity, created_at
        FROM cross_chapter_states WHERE work_id = ? ORDER BY chapter_index ASC
      `).all(workId) as CrossChapterStateRow[];

      return results.map(rowToState);
    },

    findByWorkIdAndChapter: async (workId, chapterIndex) => {
      const result = sqlite.prepare(`
        SELECT id, work_id, chapter_index, character_states_json, motif_wear_json, variation_hint, chapter_summary, dominant_tone, peak_intensity, created_at
        FROM cross_chapter_states WHERE work_id = ? AND chapter_index = ?
      `).get(workId, chapterIndex) as CrossChapterStateRow | undefined;

      if (!result) return undefined;
      return rowToState(result);
    },
  };
}
