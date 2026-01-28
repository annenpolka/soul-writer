import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LearningPipeline } from '../../src/learning/learning-pipeline.js';
import { FragmentExtractor } from '../../src/learning/fragment-extractor.js';
import { SoulExpander } from '../../src/learning/soul-expander.js';
import { SoulCandidateRepository } from '../../src/storage/soul-candidate-repository.js';
import { WorkRepository } from '../../src/storage/work-repository.js';
import { DatabaseConnection } from '../../src/storage/database.js';
import type { LLMClient } from '../../src/llm/types.js';

const mockLLMClient: LLMClient = {
  complete: vi.fn().mockResolvedValue(
    JSON.stringify({
      fragments: [
        { text: 'Beautiful fragment', category: 'introspection', score: 0.92, reason: 'Good' },
      ],
    })
  ),
  getTotalTokens: vi.fn().mockReturnValue(100),
};

describe('LearningPipeline', () => {
  let db: DatabaseConnection;
  let pipeline: LearningPipeline;
  let workRepo: WorkRepository;
  let workId: string;

  beforeEach(async () => {
    db = new DatabaseConnection();
    db.runMigrations();

    const candidateRepo = new SoulCandidateRepository(db);
    workRepo = new WorkRepository(db);

    const extractor = new FragmentExtractor(mockLLMClient);
    const expander = new SoulExpander(candidateRepo);

    pipeline = new LearningPipeline(extractor, expander);

    const work = await workRepo.create({
      soulId: 'test-soul',
      title: 'Test Work',
      content: 'Test content',
      totalChapters: 1,
      totalTokens: 100,
      complianceScore: 0.9,
      readerScore: 0.85,
    });
    workId = work.id;
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a learning pipeline', () => {
      expect(pipeline).toBeInstanceOf(LearningPipeline);
    });
  });

  describe('process', () => {
    it('should extract and add candidates from high-scoring text', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId,
        text: 'Chapter text with potential fragments',
        complianceScore: 0.9,
        readerScore: 0.85,
      });

      expect(result.extracted).toBe(1);
      expect(result.added).toBe(1);
      expect(mockLLMClient.complete).toHaveBeenCalled();
    });

    it('should skip processing for low compliance score', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId,
        text: 'Low quality text',
        complianceScore: 0.7, // Below threshold
        readerScore: 0.85,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason?.toLowerCase()).toContain('compliance');
      expect(mockLLMClient.complete).not.toHaveBeenCalled();
    });

    it('should skip processing for low reader score', async () => {
      const result = await pipeline.process({
        soulId: 'test-soul',
        workId,
        text: 'Low quality text',
        complianceScore: 0.9,
        readerScore: 0.7, // Below threshold
      });

      expect(result.skipped).toBe(true);
      expect(result.reason?.toLowerCase()).toContain('reader');
      expect(mockLLMClient.complete).not.toHaveBeenCalled();
    });

    it('should filter low-quality fragments', async () => {
      (mockLLMClient.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          fragments: [
            { text: 'High quality', category: 'introspection', score: 0.92, reason: 'Great' },
            { text: 'Low quality', category: 'dialogue', score: 0.6, reason: 'Average' },
          ],
        })
      );

      const result = await pipeline.process({
        soulId: 'test-soul',
        workId,
        text: 'Mixed quality text',
        complianceScore: 0.9,
        readerScore: 0.85,
      });

      // Only high-quality fragments should be added
      expect(result.extracted).toBe(2);
      expect(result.added).toBe(1); // Only the high-quality one
    });
  });

  describe('thresholds', () => {
    it('should use default thresholds', () => {
      const thresholds = pipeline.getThresholds();

      expect(thresholds.minComplianceScore).toBe(0.85);
      expect(thresholds.minReaderScore).toBe(0.80);
      expect(thresholds.minFragmentScore).toBe(0.85);
    });

    it('should allow custom thresholds', () => {
      const candidateRepo = new SoulCandidateRepository(db);
      const extractor = new FragmentExtractor(mockLLMClient);
      const expander = new SoulExpander(candidateRepo);

      const customPipeline = new LearningPipeline(extractor, expander, {
        minComplianceScore: 0.9,
        minReaderScore: 0.85,
        minFragmentScore: 0.9,
      });

      const thresholds = customPipeline.getThresholds();

      expect(thresholds.minComplianceScore).toBe(0.9);
      expect(thresholds.minReaderScore).toBe(0.85);
      expect(thresholds.minFragmentScore).toBe(0.9);
    });
  });
});
