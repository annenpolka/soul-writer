/**
 * FP BatchRunner Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBatchRunner,
  type BatchRunnerFn,
  type BatchDependencies,
} from '../../src/factory/batch-runner.js';
import type { FactoryConfig } from '../../src/schemas/factory-config.js';

const mockConfig: FactoryConfig = {
  count: 3,
  parallel: 1,
  chaptersPerStory: 5,
  soulPath: 'soul',
  outputDir: 'output',
  dbPath: ':memory:',
  taskDelayMs: 0,
};

const createMockSoulText = () => ({
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
});

const createMockDeps = (): BatchDependencies => ({
  soulText: createMockSoulText() as any,
  llmClient: {
    complete: vi.fn().mockResolvedValue('{}'),
    completeWithTools: vi.fn().mockResolvedValue({ toolCalls: [], content: null, tokensUsed: 0 }),
    getTotalTokens: vi.fn().mockReturnValue(0),
  },
  taskRepo: { create: vi.fn().mockResolvedValue({ id: 'task-1' }), markStarted: vi.fn(), markCompleted: vi.fn(), markFailed: vi.fn() } as any,
  workRepo: { create: vi.fn().mockResolvedValue({ id: 'work-1' }) } as any,
  checkpointManager: { saveCheckpoint: vi.fn() } as any,
  candidateRepo: {} as any,
});

describe('createBatchRunner (FP)', () => {
  let mockThemeGenerator: { generateTheme: ReturnType<typeof vi.fn> };
  let mockCharacterDeveloper: { develop: ReturnType<typeof vi.fn> };
  let mockPipelineFactory: ReturnType<typeof vi.fn>;
  let mockFileWriter: { writeStory: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockThemeGenerator = {
      generateTheme: vi.fn().mockResolvedValue({
        theme: { emotion: '孤独', timeline: '出会い前', characters: [{ name: '透心', isNew: false }], premise: 'テスト', scene_types: ['教室独白'] },
        tokensUsed: 100,
      }),
    };
    mockCharacterDeveloper = {
      develop: vi.fn().mockResolvedValue({
        developed: { characters: [{ name: '透心', isNew: false, role: '主人公' }], castingRationale: 'テスト' },
        tokensUsed: 50,
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
    mockFileWriter = { writeStory: vi.fn().mockReturnValue('/output/test.md') };
  });

  it('should create a BatchRunnerFn', () => {
    const runner: BatchRunnerFn = createBatchRunner(mockConfig, createMockDeps(), {
      themeGenerator: mockThemeGenerator as any,
      characterDeveloper: mockCharacterDeveloper as any,
      pipelineFactory: mockPipelineFactory as any,
      fileWriter: mockFileWriter as any,
    });
    expect(runner.run).toBeInstanceOf(Function);
  });

  it('should generate specified number of stories', async () => {
    const runner = createBatchRunner(mockConfig, createMockDeps(), {
      themeGenerator: mockThemeGenerator as any,
      characterDeveloper: mockCharacterDeveloper as any,
      pipelineFactory: mockPipelineFactory as any,
      fileWriter: mockFileWriter as any,
    });
    const result = await runner.run();
    expect(result.totalTasks).toBe(3);
    expect(result.completed).toBe(3);
  });

  it('should call progress callback', async () => {
    const progressCallback = vi.fn();
    const runner = createBatchRunner(mockConfig, createMockDeps(), {
      themeGenerator: mockThemeGenerator as any,
      characterDeveloper: mockCharacterDeveloper as any,
      pipelineFactory: mockPipelineFactory as any,
      fileWriter: mockFileWriter as any,
    });
    await runner.run(progressCallback);
    expect(progressCallback).toHaveBeenCalledTimes(3);
  });

  it('should handle failures gracefully', async () => {
    let callCount = 0;
    const failingPipeline = vi.fn().mockReturnValue({
      generateStory: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) throw new Error('Test failure');
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

    const runner = createBatchRunner(mockConfig, createMockDeps(), {
      themeGenerator: mockThemeGenerator as any,
      characterDeveloper: mockCharacterDeveloper as any,
      pipelineFactory: failingPipeline as any,
      fileWriter: mockFileWriter as any,
    });
    const result = await runner.run();
    expect(result.completed).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('should aggregate token usage', async () => {
    const runner = createBatchRunner(mockConfig, createMockDeps(), {
      themeGenerator: mockThemeGenerator as any,
      characterDeveloper: mockCharacterDeveloper as any,
      pipelineFactory: mockPipelineFactory as any,
      fileWriter: mockFileWriter as any,
    });
    const result = await runner.run();
    expect(result.totalTokensUsed).toBe(3450);
  });
});
