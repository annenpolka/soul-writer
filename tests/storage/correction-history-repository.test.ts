import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCorrectionHistoryRepo } from '../../src/storage/correction-history-repository.js';
import type { CorrectionHistoryRepo } from '../../src/storage/correction-history-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createCorrectionHistoryRepo', () => {
  let db: DatabaseConnection;
  let repo: CorrectionHistoryRepo;

  function seedChapter(): string {
    const sqlite = db.getSqlite();
    const workId = crypto.randomUUID();
    const chapterId = crypto.randomUUID();
    sqlite.prepare(`INSERT INTO works (id, soul_id, title, content, total_chapters, total_tokens, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(workId, 'soul-1', 'W', 'C', 1, 100, 'completed', new Date().toISOString(), new Date().toISOString());
    sqlite.prepare(`INSERT INTO chapters (id, work_id, chapter_index, title, content, champion_writer_id, tokens_used, created_at) VALUES (?,?,?,?,?,?,?,?)`).run(chapterId, workId, 0, 'Ch1', 'Content', 'writer-1', 100, new Date().toISOString());
    return chapterId;
  }

  beforeEach(() => {
    db = new DatabaseConnection();
    db.runMigrations();
    repo = createCorrectionHistoryRepo(db.getSqlite());
  });

  afterEach(() => {
    db.close();
  });

  it('should return an object with all repository methods', () => {
    expect(repo.save).toBeInstanceOf(Function);
    expect(repo.findByChapterId).toBeInstanceOf(Function);
  });

  describe('save', () => {
    it('should save a correction history entry', async () => {
      const chapterId = seedChapter();

      const result = await repo.save({
        chapterId,
        attemptNumber: 1,
        violationsCount: 3,
        correctedSuccessfully: true,
        tokensUsed: 500,
      });

      expect(result.id).toBeDefined();
      expect(result.chapterId).toBe(chapterId);
      expect(result.attemptNumber).toBe(1);
      expect(result.violationsCount).toBe(3);
      expect(result.correctedSuccessfully).toBe(true);
      expect(result.tokensUsed).toBe(500);
      expect(result.createdAt).toBeDefined();
    });

    it('should save failed correction', async () => {
      const chapterId = seedChapter();

      const result = await repo.save({
        chapterId,
        attemptNumber: 3,
        violationsCount: 1,
        correctedSuccessfully: false,
        tokensUsed: 800,
      });

      expect(result.correctedSuccessfully).toBe(false);
    });
  });

  describe('findByChapterId', () => {
    it('should find all correction attempts for a chapter', async () => {
      const chapterId = seedChapter();

      await repo.save({ chapterId, attemptNumber: 1, violationsCount: 5, correctedSuccessfully: false, tokensUsed: 300 });
      await repo.save({ chapterId, attemptNumber: 2, violationsCount: 2, correctedSuccessfully: false, tokensUsed: 400 });
      await repo.save({ chapterId, attemptNumber: 3, violationsCount: 0, correctedSuccessfully: true, tokensUsed: 500 });

      const found = await repo.findByChapterId(chapterId);
      expect(found).toHaveLength(3);
      expect(found[0].attemptNumber).toBe(1);
      expect(found[2].correctedSuccessfully).toBe(true);
    });

    it('should return empty array for non-existent chapter', async () => {
      const found = await repo.findByChapterId('non-existent');
      expect(found).toEqual([]);
    });
  });
});
