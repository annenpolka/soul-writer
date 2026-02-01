/**
 * FullPipeline Tests
 * Tests for the full story generation pipeline with all features
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FullPipeline } from '../../src/pipeline/full.js';
import { DatabaseConnection } from '../../src/storage/database.js';
import { TaskRepository } from '../../src/storage/task-repository.js';
import { WorkRepository } from '../../src/storage/work-repository.js';
import { CheckpointRepository } from '../../src/storage/checkpoint-repository.js';
import { CheckpointManager } from '../../src/storage/checkpoint-manager.js';
import { SoulCandidateRepository } from '../../src/storage/soul-candidate-repository.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

// Mock LLM client that returns appropriate responses for each agent type
const createMockLLMClient = (): LLMClient => {
  return {
    complete: vi.fn().mockImplementation((systemPrompt: string) => {
      // Plotter response
      if (systemPrompt.includes('プロット') || systemPrompt.includes('構成')) {
        return Promise.resolve(
          JSON.stringify({
            title: 'テスト小説',
            theme: 'テーマ',
            chapters: [
              {
                index: 1,
                title: '第一章',
                summary: '始まりの章',
                key_events: ['出会い', '発見'],
                target_length: 4000,
              },
              {
                index: 2,
                title: '第二章',
                summary: '展開の章',
                key_events: ['対立', '決断'],
                target_length: 4000,
              },
            ],
          })
        );
      }

      // Corrector response - returns compliant text
      if (systemPrompt.includes('矯正') || systemPrompt.includes('修正')) {
        return Promise.resolve('修正された文章です。違反は解消されました。');
      }

      // Reader evaluation response
      if (systemPrompt.includes('評価') || systemPrompt.includes('読者')) {
        return Promise.resolve(
          JSON.stringify({
            scores: {
              style: 0.85,
              plot: 0.82,
              character: 0.88,
              worldbuilding: 0.80,
              readability: 0.90,
            },
            feedback: '全体的に良い作品です。',
          })
        );
      }

      // Fragment extraction response
      if (systemPrompt.includes('断片') || systemPrompt.includes('抽出')) {
        return Promise.resolve(
          JSON.stringify({
            fragments: [
              {
                text: '透心は静かに窓の外を見つめていた',
                category: 'introspection',
                score: 0.92,
                reason: '内省的な描写',
              },
            ],
          })
        );
      }

      // Judge response
      if (systemPrompt.includes('審査') || systemPrompt.includes('比較')) {
        return Promise.resolve(
          JSON.stringify({
            winner: 'A',
            reasoning: 'Aの方が文体が優れている',
            scores: {
              A: { style: 0.9, compliance: 0.85, overall: 0.87 },
              B: { style: 0.8, compliance: 0.82, overall: 0.81 },
            },
          })
        );
      }

      // Default writer response - clean text without violations
      return Promise.resolve('透心は静かに窓の外を見つめていた。ARタグが揺らめく朝の光の中で。');
    }),
    getTotalTokens: vi.fn().mockReturnValue(100),
  };
};

const mockSoulText: SoulText = {
  ...createMockSoulText({
    forbiddenWords: ['とても', '非常に'],
    forbiddenSimiles: ['天使のような'],
  }),
  readerPersonas: {
    personas: [
      {
        id: 'test-persona',
        name: 'テスト読者',
        description: 'テスト用ペルソナ',
        preferences: ['style', 'plot'],
        evaluation_weights: {
          style: 0.2,
          plot: 0.2,
          character: 0.2,
          worldbuilding: 0.2,
          readability: 0.2,
        },
      },
    ],
  },
};

// Mock SoulTextManager
const createMockSoulManager = () => ({
  getSoulText: () => mockSoulText,
  getConstitution: () => mockSoulText.constitution,
  getWorldBible: () => mockSoulText.worldBible,
  getAntiSoul: () => mockSoulText.antiSoul,
  getReaderPersonas: () => mockSoulText.readerPersonas,
  getFragments: () => mockSoulText.fragments,
  getWriterPersonas: () => [],
  getPromptConfig: () => mockSoulText.promptConfig,
});

describe('FullPipeline', () => {
  let db: DatabaseConnection;
  let mockLLMClient: LLMClient;
  let taskRepo: TaskRepository;
  let workRepo: WorkRepository;
  let checkpointManager: CheckpointManager;
  let candidateRepo: SoulCandidateRepository;

  beforeEach(() => {
    db = new DatabaseConnection();
    db.runMigrations();
    mockLLMClient = createMockLLMClient();
    taskRepo = new TaskRepository(db);
    workRepo = new WorkRepository(db);
    const checkpointRepo = new CheckpointRepository(db);
    checkpointManager = new CheckpointManager(checkpointRepo);
    candidateRepo = new SoulCandidateRepository(db);
    vi.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  describe('constructor', () => {
    it('should create a full pipeline with dependencies', () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo
      );
      expect(pipeline).toBeInstanceOf(FullPipeline);
    });

    it('should accept partial config and use defaults', () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        { chapterCount: 3 }
      );
      expect(pipeline).toBeInstanceOf(FullPipeline);
    });
  });

  describe('generateStory', () => {
    it('should generate plot and all chapters', async () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        { chapterCount: 2 }
      );

      const result = await pipeline.generateStory('テスト生成');

      expect(result.taskId).toBeDefined();
      expect(result.plot.title).toBe('テスト小説');
      expect(result.chapters).toHaveLength(2);
    });

    it('should run compliance check on each chapter', async () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        { chapterCount: 2 }
      );

      const result = await pipeline.generateStory('テスト生成');

      for (const chapter of result.chapters) {
        expect(chapter.complianceResult).toBeDefined();
        expect(chapter.complianceResult.score).toBeGreaterThanOrEqual(0);
        expect(chapter.complianceResult.score).toBeLessThanOrEqual(1);
      }
    });

    it('should run reader jury evaluation on each chapter', async () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        { chapterCount: 2 }
      );

      const result = await pipeline.generateStory('テスト生成');

      for (const chapter of result.chapters) {
        expect(chapter.readerJuryResult).toBeDefined();
        expect(chapter.readerJuryResult.aggregatedScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('should save checkpoints per chapter', async () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        { chapterCount: 2 }
      );

      const result = await pipeline.generateStory('テスト生成');

      // Verify checkpoint was saved
      const canResume = await checkpointManager.canResume(result.taskId);
      expect(canResume).toBe(true);
    });

    it('should mark task as completed on success', async () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        { chapterCount: 2 }
      );

      const result = await pipeline.generateStory('テスト生成');

      const task = await taskRepo.findById(result.taskId);
      expect(task?.status).toBe('completed');
    });

    it('should archive work in database', async () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        { chapterCount: 2 }
      );

      await pipeline.generateStory('テスト生成');

      const works = await workRepo.findBySoulId('test');
      expect(works.length).toBeGreaterThan(0);
      expect(works[0].title).toBe('テスト小説');
    });
  });

  describe('resume', () => {
    it('should resume from checkpoint', async () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        { chapterCount: 2 }
      );

      // First, create a task and save a checkpoint
      const task = await taskRepo.create({
        soulId: 'full-pipeline-test',
        params: { prompt: 'テスト生成' },
      });

      await checkpointManager.saveCheckpoint(
        task.id,
        'chapter_done',
        {
          plot: {
            title: 'テスト小説',
            theme: 'テーマ',
            chapters: [
              { index: 1, title: '第一章', summary: '始まり', key_events: ['出会い'], target_length: 4000 },
              { index: 2, title: '第二章', summary: '展開', key_events: ['対立'], target_length: 4000 },
            ],
          },
          chapters: [
            {
              chapterIndex: 1,
              text: '最初の章の内容',
              champion: 'writer_1',
              complianceResult: { isCompliant: true, score: 1, violations: [] },
              correctionAttempts: 0,
              readerJuryResult: { evaluations: [], aggregatedScore: 0.85, passed: true, summary: '' },
              tokensUsed: 100,
            },
          ],
        },
        { completedChapters: 1, totalChapters: 2 }
      );

      const result = await pipeline.resume(task.id);

      // Should complete remaining chapters
      expect(result.chapters).toHaveLength(2);
      expect(result.taskId).toBe(task.id);
    });

    it('should throw error for non-existent checkpoint', async () => {
      const soulManager = createMockSoulManager();
      const pipeline = new FullPipeline(
        mockLLMClient,
        soulManager as any,
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo
      );

      await expect(pipeline.resume('non-existent-task')).rejects.toThrow();
    });
  });
});
