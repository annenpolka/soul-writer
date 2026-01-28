import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SoulExpander } from '../../src/learning/soul-expander.js';
import { SoulCandidateRepository } from '../../src/storage/soul-candidate-repository.js';
import { WorkRepository } from '../../src/storage/work-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';
import type { ExtractedFragment } from '../../src/learning/fragment-extractor.js';

describe('SoulExpander', () => {
  let db: DatabaseConnection;
  let candidateRepo: SoulCandidateRepository;
  let workRepo: WorkRepository;
  let expander: SoulExpander;
  let workId: string;

  beforeEach(async () => {
    db = new DatabaseConnection();
    db.runMigrations();
    candidateRepo = new SoulCandidateRepository(db);
    workRepo = new WorkRepository(db);
    expander = new SoulExpander(candidateRepo);

    const work = await workRepo.create({
      soulId: 'test-soul',
      title: 'Test Work',
      content: 'Content',
      totalChapters: 1,
      totalTokens: 100,
    });
    workId = work.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('constructor', () => {
    it('should create an expander', () => {
      expect(expander).toBeInstanceOf(SoulExpander);
    });
  });

  describe('addCandidates', () => {
    it('should add fragments as candidates', async () => {
      const fragments: ExtractedFragment[] = [
        {
          text: 'Beautiful introspection',
          category: 'introspection',
          score: 0.92,
          reason: 'Deep emotion',
        },
        {
          text: 'Sharp dialogue',
          category: 'dialogue',
          score: 0.88,
          reason: 'Natural flow',
        },
      ];

      const result = await expander.addCandidates('test-soul', workId, fragments);

      expect(result.added).toBe(2);
      expect(result.candidates).toHaveLength(2);
    });

    it('should create candidates with pending status', async () => {
      const fragments: ExtractedFragment[] = [
        {
          text: 'Test fragment',
          category: 'opening',
          score: 0.9,
          reason: 'Good',
        },
      ];

      const result = await expander.addCandidates('test-soul', workId, fragments);

      expect(result.candidates[0].status).toBe('pending');
    });

    it('should handle empty fragments array', async () => {
      const result = await expander.addCandidates('test-soul', workId, []);

      expect(result.added).toBe(0);
      expect(result.candidates).toHaveLength(0);
    });
  });

  describe('getPendingCandidates', () => {
    it('should return pending candidates for a soul', async () => {
      const fragments: ExtractedFragment[] = [
        { text: 'Fragment 1', category: 'opening', score: 0.9, reason: 'Good' },
        { text: 'Fragment 2', category: 'closing', score: 0.85, reason: 'Nice' },
      ];

      await expander.addCandidates('test-soul', workId, fragments);

      const pending = await expander.getPendingCandidates('test-soul');

      expect(pending).toHaveLength(2);
    });
  });

  describe('approveCandidate', () => {
    it('should approve a candidate', async () => {
      const fragments: ExtractedFragment[] = [
        { text: 'To approve', category: 'introspection', score: 0.95, reason: 'Great' },
      ];

      const { candidates } = await expander.addCandidates('test-soul', workId, fragments);
      const approved = await expander.approveCandidate(candidates[0].id, 'Excellent example');

      expect(approved?.status).toBe('approved');
      expect(approved?.reviewerNotes).toBe('Excellent example');
    });
  });

  describe('rejectCandidate', () => {
    it('should reject a candidate', async () => {
      const fragments: ExtractedFragment[] = [
        { text: 'To reject', category: 'dialogue', score: 0.7, reason: 'Average' },
      ];

      const { candidates } = await expander.addCandidates('test-soul', workId, fragments);
      const rejected = await expander.rejectCandidate(candidates[0].id, 'Not suitable');

      expect(rejected?.status).toBe('rejected');
    });
  });
});
