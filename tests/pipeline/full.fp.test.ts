/**
 * FP FullPipeline Tests
 * Tests for createFullPipeline() factory function
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../../src/storage/database.js';
import { createTaskRepo } from '../../src/storage/task-repository.js';
import { createWorkRepo } from '../../src/storage/work-repository.js';
import { createCheckpointRepo } from '../../src/storage/checkpoint-repository.js';
import { createCheckpointManager } from '../../src/storage/checkpoint-manager.js';
import { createSoulCandidateRepo } from '../../src/storage/soul-candidate-repository.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText, SoulTextManagerFn } from '../../src/soul/manager.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import {
  createFullPipeline,
  type FullPipelineDeps,
} from '../../src/pipeline/full.js';

// Mock LLM client
const createMockLLMClient = (): LLMClient => {
  return {
    complete: vi.fn().mockImplementation((systemPrompt: string) => {
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
      if (systemPrompt.includes('矯正') || systemPrompt.includes('修正')) {
        return Promise.resolve('修正された文章です。違反は解消されました。');
      }
      if (systemPrompt.includes('評価') || systemPrompt.includes('読者')) {
        return Promise.resolve(
          JSON.stringify({
            scores: { style: 0.85, plot: 0.82, character: 0.88, worldbuilding: 0.80, readability: 0.90 },
            feedback: '全体的に良い作品です。',
          })
        );
      }
      if (systemPrompt.includes('断片') || systemPrompt.includes('抽出')) {
        return Promise.resolve(
          JSON.stringify({
            fragments: [{ text: '透心は静かに窓の外を見つめていた', category: 'introspection', score: 0.92, reason: '内省的な描写' }],
          })
        );
      }
      if (systemPrompt.includes('審査') || systemPrompt.includes('比較')) {
        return Promise.resolve(
          JSON.stringify({
            winner: 'A',
            reasoning: 'Aの方が文体が優れている',
            scores: { A: { style: 0.9, compliance: 0.85, overall: 0.87 }, B: { style: 0.8, compliance: 0.82, overall: 0.81 } },
          })
        );
      }
      return Promise.resolve('透心は静かに窓の外を見つめていた。ARタグが揺らめく朝の光の中で。');
    }),
    completeWithTools: vi.fn().mockImplementation((_systemPrompt: string, _userPrompt: string, tools) => {
      const toolName = tools[0]?.function?.name;
      if (toolName === 'submit_plot_skeleton') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1', type: 'function',
            function: {
              name: 'submit_plot_skeleton',
              arguments: JSON.stringify({
                title: 'テスト小説', theme: 'テーマ',
                chapters: [
                  { index: 1, title: '第一章', summary: '始まりの章', key_events: ['出会い', '発見'], target_length: 4000 },
                  { index: 2, title: '第二章', summary: '展開の章', key_events: ['対立', '決断'], target_length: 4000 },
                ],
              }),
            },
          }],
          content: null, tokensUsed: 50,
        });
      }
      if (toolName === 'submit_chapter_constraints') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1', type: 'function',
            function: {
              name: 'submit_chapter_constraints',
              arguments: JSON.stringify({
                chapters: [
                  { index: 1, variation_constraints: { structure_type: 'single_scene', emotional_arc: 'ascending', pacing: 'slow_burn' } },
                  { index: 2, variation_constraints: { structure_type: 'parallel_montage', emotional_arc: 'descending', pacing: 'rapid_cuts', deviation_from_previous: '前章との差分' } },
                ],
              }),
            },
          }],
          content: null, tokensUsed: 50,
        });
      }
      if (toolName === 'submit_reader_evaluation') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1', type: 'function',
            function: {
              name: 'submit_reader_evaluation',
              arguments: JSON.stringify({
                categoryScores: { style: 0.5, plot: 0.5, character: 0.5, worldbuilding: 0.5, readability: 0.5 },
                feedback: '評価は低め',
              }),
            },
          }],
          content: null, tokensUsed: 50,
        });
      }
      if (toolName === 'submit_judgement') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1', type: 'function',
            function: {
              name: 'submit_judgement',
              arguments: JSON.stringify({
                winner: 'A',
                reasoning: 'Aの方が文体が優れている',
                scores: { A: { style: 0.9, compliance: 0.85, overall: 0.87 }, B: { style: 0.8, compliance: 0.82, overall: 0.81 } },
                praised_excerpts: { A: [], B: [] },
              }),
            },
          }],
          content: null, tokensUsed: 50,
        });
      }
      if (toolName === 'report_chapter_analysis') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1', type: 'function',
            function: {
              name: 'report_chapter_analysis',
              arguments: JSON.stringify({
                storySummary: '前章の要約',
                emotionalBeats: ['疎外', '怒り'],
                dominantImagery: ['金属', '冷たさ'],
                rhythmProfile: '短文連打',
                structuralPattern: '観察→内省',
              }),
            },
          }],
          content: null, tokensUsed: 50,
        });
      }
      if (toolName === 'report_chapter_variation') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1', type: 'function',
            function: {
              name: 'report_chapter_variation',
              arguments: JSON.stringify({ issues: [] }),
            },
          }],
          content: null, tokensUsed: 50,
        });
      }
      if (toolName === 'report_repetitions') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1', type: 'function',
            function: {
              name: 'report_repetitions',
              arguments: JSON.stringify({ repetitions: [] }),
            },
          }],
          content: null, tokensUsed: 50,
        });
      }
      return Promise.resolve({ toolCalls: [], content: null, tokensUsed: 0 });
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
        evaluation_weights: { style: 0.2, plot: 0.2, character: 0.2, worldbuilding: 0.2, readability: 0.2 },
      },
    ],
  },
};

const createMockSoulManager = (): SoulTextManagerFn => ({
  getSoulText: () => mockSoulText,
  getConstitution: () => mockSoulText.constitution,
  getWorldBible: () => mockSoulText.worldBible,
  getAntiSoul: () => mockSoulText.antiSoul,
  getReaderPersonas: () => mockSoulText.readerPersonas,
  getFragments: () => mockSoulText.fragments,
  getWriterPersonas: () => [],
  getCollabPersonas: () => [],
  getPromptConfig: () => mockSoulText.promptConfig,
  clearRawSoultext: () => {},
}) as unknown as SoulTextManagerFn;

describe('createFullPipeline (FP)', () => {
  let db: DatabaseConnection;
  let mockLLMClient: LLMClient;
  let deps: FullPipelineDeps;

  beforeEach(() => {
    db = new DatabaseConnection();
    db.runMigrations();
    mockLLMClient = createMockLLMClient();
    const sqlite = db.getSqlite();
    const taskRepo = createTaskRepo(sqlite);
    const workRepo = createWorkRepo(sqlite);
    const checkpointRepo = createCheckpointRepo(sqlite);
    const checkpointManager = createCheckpointManager(checkpointRepo);
    const candidateRepo = createSoulCandidateRepo(sqlite);

    deps = {
      llmClient: mockLLMClient,
      soulManager: createMockSoulManager(),
      checkpointManager,
      taskRepo,
      workRepo,
      candidateRepo,
      config: { chapterCount: 2, targetTotalLength: 8000, maxCorrectionAttempts: 3, dbPath: ':memory:' },
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  it('should create a FullPipelineRunner', () => {
    const runner = createFullPipeline(deps);
    expect(runner).toBeDefined();
    expect(runner.generateStory).toBeInstanceOf(Function);
    expect(runner.resume).toBeInstanceOf(Function);
    expect(runner.getConfig).toBeInstanceOf(Function);
  });

  it('should generate story with plot and chapters', async () => {
    const runner = createFullPipeline(deps);
    const result = await runner.generateStory('テスト生成');

    expect(result.taskId).toBeDefined();
    expect(result.plot.title).toBe('テスト小説');
    expect(result.chapters).toHaveLength(2);
  });

  it('should run compliance check on each chapter', async () => {
    const runner = createFullPipeline(deps);
    const result = await runner.generateStory('テスト生成');

    for (const chapter of result.chapters) {
      expect(chapter.complianceResult).toBeDefined();
      expect(chapter.complianceResult.score).toBeGreaterThanOrEqual(0);
      expect(chapter.complianceResult.score).toBeLessThanOrEqual(1);
    }
  });

  it('should run reader jury evaluation on each chapter', async () => {
    const runner = createFullPipeline(deps);
    const result = await runner.generateStory('テスト生成');

    for (const chapter of result.chapters) {
      expect(chapter.readerJuryResult).toBeDefined();
      expect(chapter.readerJuryResult.aggregatedScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('should save checkpoints per chapter', async () => {
    const runner = createFullPipeline(deps);
    const result = await runner.generateStory('テスト生成');

    const canResume = await deps.checkpointManager.canResume(result.taskId);
    expect(canResume).toBe(true);
  });

  it('should mark task as completed on success', async () => {
    const runner = createFullPipeline(deps);
    const result = await runner.generateStory('テスト生成');

    const task = await deps.taskRepo.findById(result.taskId);
    expect(task?.status).toBe('completed');
  });

  it('should archive work in database', async () => {
    const runner = createFullPipeline(deps);
    await runner.generateStory('テスト生成');

    const works = await deps.workRepo.findBySoulId('test');
    expect(works.length).toBeGreaterThan(0);
    expect(works[0].title).toBe('テスト小説');
  });

  it('should return config via getConfig', () => {
    const runner = createFullPipeline(deps);
    const config = runner.getConfig();
    expect(config.chapterCount).toBe(2);
    expect(config.targetTotalLength).toBe(8000);
  });

  describe('resume', () => {
    it('should resume from checkpoint', async () => {
      const runner = createFullPipeline(deps);

      const task = await deps.taskRepo.create({
        soulId: 'test',
        params: { prompt: 'テスト生成' },
      });

      await deps.checkpointManager.saveCheckpoint(
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

      const result = await runner.resume(task.id);
      expect(result.chapters).toHaveLength(2);
      expect(result.taskId).toBe(task.id);
    });

    it('should throw error for non-existent checkpoint', async () => {
      const runner = createFullPipeline(deps);
      await expect(runner.resume('non-existent-task')).rejects.toThrow();
    });
  });
});
