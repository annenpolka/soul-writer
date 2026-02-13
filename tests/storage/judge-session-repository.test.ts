import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createJudgeSessionRepo } from '../../src/storage/judge-session-repository.js';
import type { JudgeSessionRepo } from '../../src/storage/judge-session-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createJudgeSessionRepo', () => {
  let db: DatabaseConnection;
  let repo: JudgeSessionRepo;

  // Helper: create prerequisite rows for FK constraints
  function seedPrerequisites(matchId: string) {
    const sqlite = db.getSqlite();
    const workId = crypto.randomUUID();
    const chapterId = crypto.randomUUID();
    sqlite.prepare(`INSERT INTO works (id, soul_id, title, content, total_chapters, total_tokens, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(workId, 'soul-1', 'W', 'C', 1, 100, 'completed', new Date().toISOString(), new Date().toISOString());
    sqlite.prepare(`INSERT INTO chapters (id, work_id, chapter_index, title, content, champion_writer_id, tokens_used, created_at) VALUES (?,?,?,?,?,?,?,?)`).run(chapterId, workId, 0, 'Ch1', 'Content', 'writer-1', 100, new Date().toISOString());
    sqlite.prepare(`INSERT INTO tournament_matches (id, chapter_id, match_name, contestant_a, contestant_b, winner, reasoning, created_at) VALUES (?,?,?,?,?,?,?,?)`).run(matchId, chapterId, 'match-1', 'A', 'B', 'A', 'Better', new Date().toISOString());
  }

  beforeEach(() => {
    db = new DatabaseConnection(); // in-memory
    db.runMigrations();
    repo = createJudgeSessionRepo(db.getSqlite());
  });

  afterEach(() => {
    db.close();
  });

  it('should return an object with all repository methods', () => {
    expect(repo.save).toBeInstanceOf(Function);
    expect(repo.findByMatchId).toBeInstanceOf(Function);
  });

  describe('save', () => {
    it('should save a judge session result', async () => {
      const matchId = crypto.randomUUID();
      seedPrerequisites(matchId);

      const result = await repo.save({
        matchId,
        scores: { styleAccuracy: 0.8, originality: 0.9 },
        axisComments: { styleAccuracy: 'Good style' },
        weaknesses: ['Pacing issue'],
        sectionAnalysis: [{ section: 'opening', comment: 'Strong' }],
        praisedExcerpts: ['Beautiful prose on page 3'],
      });

      expect(result.id).toBeDefined();
      expect(result.matchId).toBe(matchId);
      expect(result.scores).toEqual({ styleAccuracy: 0.8, originality: 0.9 });
      expect(result.weaknesses).toEqual(['Pacing issue']);
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('findByMatchId', () => {
    it('should find session results by match id', async () => {
      const matchId = crypto.randomUUID();
      seedPrerequisites(matchId);

      await repo.save({
        matchId,
        scores: { a: 1 },
        axisComments: { a: 'ok' },
        weaknesses: [],
        sectionAnalysis: [],
        praisedExcerpts: [],
      });

      const found = await repo.findByMatchId(matchId);
      expect(found).toBeDefined();
      expect(found?.matchId).toBe(matchId);
      expect(found?.scores).toEqual({ a: 1 });
    });

    it('should return undefined for non-existent match', async () => {
      const found = await repo.findByMatchId('non-existent');
      expect(found).toBeUndefined();
    });
  });
});
