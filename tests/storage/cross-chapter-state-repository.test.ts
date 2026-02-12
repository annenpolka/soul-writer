import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCrossChapterStateRepo } from '../../src/storage/cross-chapter-state-repository.js';
import type { CrossChapterStateRepo } from '../../src/storage/cross-chapter-state-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('createCrossChapterStateRepo', () => {
  let db: DatabaseConnection;
  let repo: CrossChapterStateRepo;

  function seedWork(): string {
    const sqlite = db.getSqlite();
    const id = crypto.randomUUID();
    sqlite.prepare(`INSERT INTO works (id, soul_id, title, content, total_chapters, total_tokens, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, 'soul-1', 'W', 'C', 3, 300, 'completed', new Date().toISOString(), new Date().toISOString());
    return id;
  }

  beforeEach(() => {
    db = new DatabaseConnection();
    db.runMigrations();
    repo = createCrossChapterStateRepo(db.getSqlite());
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
    it('should save a cross-chapter state', async () => {
      const workId = seedWork();

      const result = await repo.save({
        workId,
        chapterIndex: 0,
        characterStates: { protagonist: { mood: 'determined', health: 'good' } },
        motifWear: { 'red-thread': 2 },
        variationHint: 'Try a slower pace',
        chapterSummary: 'Chapter 1 summary',
        dominantTone: 'tense',
        peakIntensity: 0.85,
      });

      expect(result.id).toBeDefined();
      expect(result.workId).toBe(workId);
      expect(result.chapterIndex).toBe(0);
      expect(result.characterStates).toEqual({ protagonist: { mood: 'determined', health: 'good' } });
      expect(result.motifWear).toEqual({ 'red-thread': 2 });
      expect(result.variationHint).toBe('Try a slower pace');
      expect(result.dominantTone).toBe('tense');
      expect(result.peakIntensity).toBe(0.85);
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('findByWorkId', () => {
    it('should find all states for a work', async () => {
      const workId = seedWork();

      await repo.save({ workId, chapterIndex: 0, characterStates: {}, motifWear: {}, variationHint: 'v1', chapterSummary: 'S1', dominantTone: 'calm', peakIntensity: 0.3 });
      await repo.save({ workId, chapterIndex: 1, characterStates: {}, motifWear: {}, variationHint: 'v2', chapterSummary: 'S2', dominantTone: 'tense', peakIntensity: 0.7 });

      const found = await repo.findByWorkId(workId);
      expect(found).toHaveLength(2);
    });

    it('should return empty array for non-existent work', async () => {
      const found = await repo.findByWorkId('non-existent');
      expect(found).toEqual([]);
    });
  });

  describe('findByWorkIdAndChapter', () => {
    it('should find state for specific chapter', async () => {
      const workId = seedWork();

      await repo.save({ workId, chapterIndex: 0, characterStates: {}, motifWear: {}, variationHint: 'v1', chapterSummary: 'S1', dominantTone: 'calm', peakIntensity: 0.3 });
      await repo.save({ workId, chapterIndex: 1, characterStates: { hero: { status: 'injured' } }, motifWear: {}, variationHint: 'v2', chapterSummary: 'S2', dominantTone: 'dark', peakIntensity: 0.9 });

      const found = await repo.findByWorkIdAndChapter(workId, 1);
      expect(found).toBeDefined();
      expect(found?.chapterIndex).toBe(1);
      expect(found?.characterStates).toEqual({ hero: { status: 'injured' } });
      expect(found?.dominantTone).toBe('dark');
    });

    it('should return undefined for non-existent chapter index', async () => {
      const workId = seedWork();
      const found = await repo.findByWorkIdAndChapter(workId, 99);
      expect(found).toBeUndefined();
    });
  });
});
