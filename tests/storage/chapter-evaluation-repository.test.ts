import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChapterEvalRepo } from '../../src/storage/chapter-evaluation-repository.js';
import type { ChapterEvalRepo } from '../../src/storage/chapter-evaluation-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createChapterEvalRepo', () => {
  let db: DatabaseConnection;
  let repo: ChapterEvalRepo;
  let workId: string;

  function seedWork(): string {
    const sqlite = db.getSqlite();
    const id = crypto.randomUUID();
    sqlite.prepare(`INSERT INTO works (id, soul_id, title, content, total_chapters, total_tokens, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, 'soul-1', 'W', 'C', 1, 100, 'completed', new Date().toISOString(), new Date().toISOString());
    return id;
  }

  function seedChapter(wId: string, index: number = 0): string {
    const sqlite = db.getSqlite();
    const id = crypto.randomUUID();
    sqlite.prepare(`INSERT INTO chapters (id, work_id, chapter_index, title, content, champion_writer_id, tokens_used, created_at) VALUES (?,?,?,?,?,?,?,?)`).run(id, wId, index, `Ch${index}`, 'Content', 'writer-1', 100, new Date().toISOString());
    return id;
  }

  beforeEach(() => {
    db = new DatabaseConnection();
    db.runMigrations();
    repo = createChapterEvalRepo(db.getSqlite());
    workId = seedWork();
  });

  afterEach(() => {
    db.close();
  });

  it('should return an object with all repository methods', () => {
    expect(repo.save).toBeInstanceOf(Function);
    expect(repo.findByChapterId).toBeInstanceOf(Function);
    expect(repo.findByWorkId).toBeInstanceOf(Function);
  });

  describe('save', () => {
    it('should save a chapter evaluation', async () => {
      const chapterId = seedChapter(workId);

      const result = await repo.save({
        chapterId,
        verdictLevel: 'publishable',
        defects: [{ type: 'minor', description: 'Typo' }],
        criticalCount: 0,
        majorCount: 0,
        minorCount: 1,
        feedback: 'Good overall',
      });

      expect(result.id).toBeDefined();
      expect(result.chapterId).toBe(chapterId);
      expect(result.verdictLevel).toBe('publishable');
      expect(result.defects).toEqual([{ type: 'minor', description: 'Typo' }]);
      expect(result.criticalCount).toBe(0);
      expect(result.minorCount).toBe(1);
      expect(result.feedback).toBe('Good overall');
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('findByChapterId', () => {
    it('should find evaluations by chapter id', async () => {
      const chapterId = seedChapter(workId);

      await repo.save({
        chapterId,
        verdictLevel: 'needs_work',
        defects: [],
        criticalCount: 1,
        majorCount: 0,
        minorCount: 0,
        feedback: 'Critical issue found',
      });

      const found = await repo.findByChapterId(chapterId);
      expect(found).toHaveLength(1);
      expect(found[0].verdictLevel).toBe('needs_work');
    });

    it('should return empty array for non-existent chapter', async () => {
      const found = await repo.findByChapterId('non-existent');
      expect(found).toEqual([]);
    });
  });

  describe('findByWorkId', () => {
    it('should find evaluations across chapters of a work', async () => {
      const ch1 = seedChapter(workId, 0);
      const ch2 = seedChapter(workId, 1);

      await repo.save({
        chapterId: ch1,
        verdictLevel: 'publishable',
        defects: [],
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
        feedback: 'Great',
      });

      await repo.save({
        chapterId: ch2,
        verdictLevel: 'needs_revision',
        defects: [{ type: 'major', description: 'Plot hole' }],
        criticalCount: 0,
        majorCount: 1,
        minorCount: 0,
        feedback: 'Fix plot',
      });

      const found = await repo.findByWorkId(workId);
      expect(found).toHaveLength(2);
    });
  });
});
