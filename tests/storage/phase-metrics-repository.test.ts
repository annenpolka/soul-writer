import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPhaseMetricsRepo } from '../../src/storage/phase-metrics-repository.js';
import type { PhaseMetricsRepo } from '../../src/storage/phase-metrics-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createPhaseMetricsRepo', () => {
  let db: DatabaseConnection;
  let repo: PhaseMetricsRepo;

  function seedWork(): string {
    const sqlite = db.getSqlite();
    const id = crypto.randomUUID();
    sqlite.prepare(`INSERT INTO works (id, soul_id, title, content, total_chapters, total_tokens, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, 'soul-1', 'W', 'C', 3, 300, 'completed', new Date().toISOString(), new Date().toISOString());
    return id;
  }

  beforeEach(() => {
    db = new DatabaseConnection();
    db.runMigrations();
    repo = createPhaseMetricsRepo(db.getSqlite());
  });

  afterEach(() => {
    db.close();
  });

  it('should return an object with all repository methods', () => {
    expect(repo.save).toBeInstanceOf(Function);
    expect(repo.findByWorkId).toBeInstanceOf(Function);
    expect(repo.findByWorkIdAndChapter).toBeInstanceOf(Function);
  });

  describe('save', () => {
    it('should save a phase metric', async () => {
      const workId = seedWork();

      const result = await repo.save({
        workId,
        chapterIndex: 0,
        phase: 'plotting',
        durationMs: 3500,
        tokensUsed: 1200,
      });

      expect(result.id).toBeDefined();
      expect(result.workId).toBe(workId);
      expect(result.chapterIndex).toBe(0);
      expect(result.phase).toBe('plotting');
      expect(result.durationMs).toBe(3500);
      expect(result.tokensUsed).toBe(1200);
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('findByWorkId', () => {
    it('should find all metrics for a work', async () => {
      const workId = seedWork();

      await repo.save({ workId, chapterIndex: 0, phase: 'plotting', durationMs: 1000, tokensUsed: 500 });
      await repo.save({ workId, chapterIndex: 0, phase: 'writing', durationMs: 5000, tokensUsed: 3000 });
      await repo.save({ workId, chapterIndex: 1, phase: 'plotting', durationMs: 900, tokensUsed: 400 });

      const found = await repo.findByWorkId(workId);
      expect(found).toHaveLength(3);
    });

    it('should return empty array for non-existent work', async () => {
      const found = await repo.findByWorkId('non-existent');
      expect(found).toEqual([]);
    });
  });

  describe('findByWorkIdAndChapter', () => {
    it('should find metrics for specific chapter', async () => {
      const workId = seedWork();

      await repo.save({ workId, chapterIndex: 0, phase: 'plotting', durationMs: 1000, tokensUsed: 500 });
      await repo.save({ workId, chapterIndex: 0, phase: 'writing', durationMs: 5000, tokensUsed: 3000 });
      await repo.save({ workId, chapterIndex: 1, phase: 'plotting', durationMs: 900, tokensUsed: 400 });

      const found = await repo.findByWorkIdAndChapter(workId, 0);
      expect(found).toHaveLength(2);
      expect(found.every(m => m.chapterIndex === 0)).toBe(true);
    });

    it('should return empty array for non-existent chapter', async () => {
      const workId = seedWork();
      const found = await repo.findByWorkIdAndChapter(workId, 99);
      expect(found).toEqual([]);
    });
  });
});
