import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchRunner, type BatchResult, type TaskResult, type BatchDependencies } from './batch-runner.js';
import type { FactoryConfig } from '../schemas/factory-config.js';

describe('BatchRunner', () => {
  const mockConfig: FactoryConfig = {
    count: 3,
    parallel: 1,
    chaptersPerStory: 5,
    soulPath: 'soul',
    outputDir: 'output',
    dbPath: ':memory:',
  };

  const mockSoulText = {
    constitution: {
      meta: { soul_id: 'test', soul_name: 'Test', version: '1.0', created_at: '', updated_at: '' },
      sentence_structure: { rhythm_pattern: '', taigendome: { usage: '', frequency: '', forbidden_context: [] }, typical_lengths: { short: '', long: '', forbidden: '' } },
      vocabulary: { bracket_notations: [], forbidden_words: [], characteristic_expressions: [], special_marks: { mark: '×', usage: '', forms: [] } },
      rhetoric: { simile_base: '', metaphor_density: 'low' as const, forbidden_similes: [], personification_allowed_for: [] },
      narrative: { default_pov: '', pov_by_character: {}, default_tense: '', tense_shift_allowed: '', dialogue_ratio: '', dialogue_style_by_character: {} },
      thematic_constraints: { must_preserve: [], forbidden_resolutions: [] },
    },
    worldBible: { technology: {}, society: {}, characters: {}, terminology: {}, locations: {} },
    antiSoul: { categories: { excessive_sentiment: [], explanatory_worldbuilding: [], character_normalization: [], cliche_simile: [], theme_violation: [] } },
    readerPersonas: { personas: [] },
    fragments: new Map(),
  };

  let mockThemeGenerator: {
    generateTheme: ReturnType<typeof vi.fn>;
  };

  let mockPipelineFactory: ReturnType<typeof vi.fn>;

  let mockFileWriter: {
    writeStory: ReturnType<typeof vi.fn>;
  };

  const createMockDeps = (): BatchDependencies => ({
    soulText: mockSoulText as any,
    llmClient: {
      complete: vi.fn().mockResolvedValue('{}'),
      getTotalTokens: vi.fn().mockReturnValue(0),
    },
    taskRepo: {
      create: vi.fn().mockResolvedValue({ id: 'task-1' }),
      markStarted: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    } as any,
    workRepo: {
      create: vi.fn().mockResolvedValue({ id: 'work-1' }),
    } as any,
    checkpointManager: {
      saveCheckpoint: vi.fn(),
    } as any,
    candidateRepo: {} as any,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockThemeGenerator = {
      generateTheme: vi.fn().mockResolvedValue({
        theme: {
          emotion: '孤独',
          timeline: '出会い前',
          characters: [{ name: '透心', isNew: false }],
          premise: 'テスト前提',
        },
        tokensUsed: 100,
      }),
    };

    mockPipelineFactory = vi.fn().mockReturnValue({
      generateStory: vi.fn().mockResolvedValue({
        taskId: 'mock-task-id',
        plot: { title: 'テスト', theme: 'テスト', chapters: [] },
        chapters: [],
        totalTokensUsed: 1000,
        avgComplianceScore: 0.9,
        avgReaderScore: 0.85,
        learningCandidates: 0,
        antiPatternsCollected: 0,
      }),
    });

    mockFileWriter = {
      writeStory: vi.fn().mockReturnValue('/output/test.md'),
    };
  });

  describe('constructor', () => {
    it('should create a batch runner', () => {
      const runner = new BatchRunner(mockConfig, createMockDeps());
      expect(runner).toBeInstanceOf(BatchRunner);
    });
  });

  describe('run', () => {
    it('should generate specified number of stories', async () => {
      const deps = createMockDeps();
      const runner = new BatchRunner(mockConfig, deps, {
        themeGenerator: mockThemeGenerator as any,
        pipelineFactory: mockPipelineFactory,
        fileWriter: mockFileWriter as any,
      });

      const result = await runner.run();

      expect(result.totalTasks).toBe(3);
      expect(mockThemeGenerator.generateTheme).toHaveBeenCalledTimes(3);
    });

    it('should track completed tasks', async () => {
      const deps = createMockDeps();
      const runner = new BatchRunner(mockConfig, deps, {
        themeGenerator: mockThemeGenerator as any,
        pipelineFactory: mockPipelineFactory,
        fileWriter: mockFileWriter as any,
      });

      const result = await runner.run();

      expect(result.completed).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should aggregate token usage', async () => {
      const deps = createMockDeps();
      const runner = new BatchRunner(mockConfig, deps, {
        themeGenerator: mockThemeGenerator as any,
        pipelineFactory: mockPipelineFactory,
        fileWriter: mockFileWriter as any,
      });

      const result = await runner.run();

      // 100 tokens per theme + 1000 per story = 1100 per task * 3 = 3300
      expect(result.totalTokensUsed).toBe(3300);
    });

    it('should return results for each task', async () => {
      const deps = createMockDeps();
      const runner = new BatchRunner(mockConfig, deps, {
        themeGenerator: mockThemeGenerator as any,
        pipelineFactory: mockPipelineFactory,
        fileWriter: mockFileWriter as any,
      });

      const result = await runner.run();

      expect(result.results).toHaveLength(3);
      for (const taskResult of result.results) {
        expect(taskResult.status).toBe('completed');
      }
    });

    it('should call progress callback', async () => {
      const progressCallback = vi.fn();
      const deps = createMockDeps();
      const runner = new BatchRunner(mockConfig, deps, {
        themeGenerator: mockThemeGenerator as any,
        pipelineFactory: mockPipelineFactory,
        fileWriter: mockFileWriter as any,
      });

      await runner.run(progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(3);
    });

    it('should continue on failure and record error', async () => {
      let callCount = 0;
      const failingPipelineFactory = vi.fn().mockReturnValue({
        generateStory: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Test failure');
          }
          return Promise.resolve({
            taskId: `task-${callCount}`,
            plot: { title: 'テスト', theme: 'テスト', chapters: [] },
            chapters: [],
            totalTokensUsed: 1000,
            avgComplianceScore: 0.9,
            avgReaderScore: 0.85,
            learningCandidates: 0,
            antiPatternsCollected: 0,
          });
        }),
      });

      const deps = createMockDeps();
      const runner = new BatchRunner(mockConfig, deps, {
        themeGenerator: mockThemeGenerator as any,
        pipelineFactory: failingPipelineFactory,
        fileWriter: mockFileWriter as any,
      });

      const result = await runner.run();

      expect(result.completed).toBe(2);
      expect(result.failed).toBe(1);
      const failedTask = result.results.find((r) => r.status === 'failed');
      expect(failedTask?.error).toBe('Test failure');
    });

    it('should write story files', async () => {
      const deps = createMockDeps();
      const runner = new BatchRunner(mockConfig, deps, {
        themeGenerator: mockThemeGenerator as any,
        pipelineFactory: mockPipelineFactory,
        fileWriter: mockFileWriter as any,
      });

      await runner.run();

      expect(mockFileWriter.writeStory).toHaveBeenCalledTimes(3);
    });
  });
});
