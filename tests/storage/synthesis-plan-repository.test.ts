import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSynthesisPlanRepo } from '../../src/storage/synthesis-plan-repository.js';
import type { SynthesisPlanRepo } from '../../src/storage/synthesis-plan-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createSynthesisPlanRepo', () => {
  let db: DatabaseConnection;
  let repo: SynthesisPlanRepo;

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
    repo = createSynthesisPlanRepo(db.getSqlite());
  });

  afterEach(() => {
    db.close();
  });

  it('should return an object with all repository methods', () => {
    expect(repo.save).toBeInstanceOf(Function);
    expect(repo.findByChapterId).toBeInstanceOf(Function);
  });

  describe('save', () => {
    it('should save a synthesis plan', async () => {
      const chapterId = seedChapter();

      const result = await repo.save({
        chapterId,
        championAssessment: 'Strong narrative voice',
        preserveElements: ['opening scene', 'character arc'],
        actions: [{ type: 'enhance', target: 'dialogue', detail: 'Add subtext' }],
        expressionSources: [{ writerId: 'w1', excerpt: 'Beautiful prose' }],
      });

      expect(result.id).toBeDefined();
      expect(result.chapterId).toBe(chapterId);
      expect(result.championAssessment).toBe('Strong narrative voice');
      expect(result.preserveElements).toEqual(['opening scene', 'character arc']);
      expect(result.actions).toHaveLength(1);
      expect(result.expressionSources).toHaveLength(1);
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('findByChapterId', () => {
    it('should find plans by chapter id', async () => {
      const chapterId = seedChapter();

      await repo.save({
        chapterId,
        championAssessment: 'Assessment',
        preserveElements: [],
        actions: [],
        expressionSources: [],
      });

      const found = await repo.findByChapterId(chapterId);
      expect(found).toBeDefined();
      expect(found?.championAssessment).toBe('Assessment');
    });

    it('should return undefined for non-existent chapter', async () => {
      const found = await repo.findByChapterId('non-existent');
      expect(found).toBeUndefined();
    });
  });
});
