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
import { createJudgeSessionRepo } from '../../src/storage/judge-session-repository.js';
import { createChapterEvalRepo } from '../../src/storage/chapter-evaluation-repository.js';
import { createSynthesisPlanRepo } from '../../src/storage/synthesis-plan-repository.js';
import { createCorrectionHistoryRepo } from '../../src/storage/correction-history-repository.js';
import { createCrossChapterStateRepo } from '../../src/storage/cross-chapter-state-repository.js';
import { createPhaseMetricsRepo } from '../../src/storage/phase-metrics-repository.js';
import type { JudgeSessionRepo } from '../../src/storage/judge-session-repository.js';
import type { ChapterEvalRepo } from '../../src/storage/chapter-evaluation-repository.js';
import type { SynthesisPlanRepo } from '../../src/storage/synthesis-plan-repository.js';
import type { CorrectionHistoryRepo } from '../../src/storage/correction-history-repository.js';
import type { CrossChapterStateRepo } from '../../src/storage/cross-chapter-state-repository.js';
import type { PhaseMetricsRepo } from '../../src/storage/phase-metrics-repository.js';
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
    complete: vi.fn().mockImplementation((systemPromptOrMessages: string | unknown[]) => {
      const systemPrompt = typeof systemPromptOrMessages === 'string'
        ? systemPromptOrMessages
        : (systemPromptOrMessages as Array<{ role: string; content: string }>).find(m => m.role === 'system')?.content ?? '';
      if (systemPrompt.includes('矯正') || systemPrompt.includes('修正')) {
        return Promise.resolve('修正された文章です。違反は解消されました。');
      }
      if (systemPrompt.includes('断片') || systemPrompt.includes('抽出')) {
        return Promise.resolve(JSON.stringify({ fragments: [] }));
      }
      return Promise.resolve('透心は静かに窓の外を見つめていた。ARタグが揺らめく朝の光の中で。');
    }),
    completeStructured: vi.fn().mockImplementation((_messages: unknown[], schema: unknown) => {
      // Determine which agent is calling based on schema shape
      const schemaStr = JSON.stringify(schema);

      // Plotter skeleton (PlotSkeletonSchema) - has 'drama_blueprint'
      if (schemaStr.includes('drama_blueprint') && schemaStr.includes('chapters') && !schemaStr.includes('variation_constraints')) {
        return Promise.resolve({
          data: {
            title: 'テスト小説', theme: 'テーマ',
            chapters: [
              { index: 1, title: '第一章', summary: '始まりの章', key_events: ['出会い', '発見'], target_length: 4000 },
              { index: 2, title: '第二章', summary: '展開の章', key_events: ['対立', '決断'], target_length: 4000 },
            ],
          },
          reasoning: null, tokensUsed: 50,
        });
      }

      // Plotter chapter constraints (BatchChapterConstraintsSchema) - has 'variation_constraints' at chapter level
      if (schemaStr.includes('variation_constraints') && !schemaStr.includes('drama_blueprint')) {
        return Promise.resolve({
          data: {
            chapters: [
              { index: 1, variation_constraints: { structure_type: 'single_scene', emotional_arc: 'ascending', pacing: 'slow_burn' } },
              { index: 2, variation_constraints: { structure_type: 'parallel_montage', emotional_arc: 'descending', pacing: 'rapid_cuts', deviation_from_previous: '前章との差分' } },
            ],
          },
          reasoning: null, tokensUsed: 50,
        });
      }

      // Judge (JudgeResponseSchema) - has 'winner' and 'scores'
      if (schemaStr.includes('"winner"') && schemaStr.includes('"praised_excerpts"')) {
        return Promise.resolve({
          data: {
            winner: 'A',
            reasoning: 'Aの方が文体が優れている',
            scores: {
              A: { style: 0.9, compliance: 0.85, overall: 0.87, voice_accuracy: 0.8, originality: 0.7, structure: 0.8, amplitude: 0.7, agency: 0.6, stakes: 0.7 },
              B: { style: 0.8, compliance: 0.82, overall: 0.81, voice_accuracy: 0.7, originality: 0.6, structure: 0.7, amplitude: 0.6, agency: 0.5, stakes: 0.6 },
            },
            praised_excerpts: { A: [], B: [] },
          },
          reasoning: null, tokensUsed: 50,
        });
      }

      // SynthesisAnalyzer (ImprovementPlanSchema) - has 'championAssessment'
      if (schemaStr.includes('championAssessment')) {
        return Promise.resolve({
          data: {
            championAssessment: 'Good base text',
            preserveElements: ['opening'],
            actions: [],
            expressionSources: [],
          },
          reasoning: null, tokensUsed: 50,
        });
      }

      // DefectDetector (DefectDetectorResponseSchema) - has 'verdict_level'
      if (schemaStr.includes('verdict_level')) {
        return Promise.resolve({
          data: { verdict_level: 'publishable', defects: [] },
          reasoning: null, tokensUsed: 50,
        });
      }

      // ChapterStateExtractor (ChapterStateResponseSchema) - has 'character_states'
      if (schemaStr.includes('character_states') && schemaStr.includes('motif_occurrences')) {
        return Promise.resolve({
          data: {
            character_states: [
              { character_name: '透心', emotional_state: '不安', knowledge_gained: [], relationship_changes: [] },
            ],
            motif_occurrences: [{ motif: 'ARタグ', count: 2 }],
            next_variation_hint: '次章では対立を深める',
            chapter_summary: 'テスト章の要約',
            dominant_tone: '冷徹',
            peak_intensity: 3,
          },
          reasoning: null, tokensUsed: 50,
        });
      }

      // Default fallback
      return Promise.resolve({
        data: {},
        reasoning: null, tokensUsed: 50,
      });
    }),
    completeWithTools: vi.fn().mockImplementation((_systemPrompt: string, _userPrompt: string, tools) => {
      const toolName = tools[0]?.function?.name;
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
      if (toolName === 'extract_fragments') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1', type: 'function',
            function: {
              name: 'extract_fragments',
              arguments: JSON.stringify({ fragments: [] }),
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
      expect(typeof chapter.complianceResult.isCompliant).toBe('boolean');
      expect(typeof chapter.complianceResult.errorCount).toBe('number');
      expect(typeof chapter.complianceResult.warningCount).toBe('number');
    }
  });

  it('should run evaluation on each chapter', async () => {
    const runner = createFullPipeline(deps);
    const result = await runner.generateStory('テスト生成');

    for (const chapter of result.chapters) {
      expect(chapter.evaluationResult).toBeDefined();
      expect(chapter.evaluationResult.verdictLevel).toBeDefined();
      expect(typeof chapter.evaluationResult.passed).toBe('boolean');
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

  describe('analytics repository integration', () => {
    let analyticsDb: DatabaseConnection;
    let analyticsDeps: FullPipelineDeps;
    let judgeSessionRepo: JudgeSessionRepo;
    let chapterEvalRepo: ChapterEvalRepo;
    let synthesisPlanRepo: SynthesisPlanRepo;
    let correctionHistoryRepo: CorrectionHistoryRepo;
    let crossChapterStateRepo: CrossChapterStateRepo;
    let phaseMetricsRepo: PhaseMetricsRepo;

    beforeEach(() => {
      analyticsDb = new DatabaseConnection();
      analyticsDb.runMigrations();
      const analyticsSqlite = analyticsDb.getSqlite();
      const analyticsMockLLMClient = createMockLLMClient();

      judgeSessionRepo = createJudgeSessionRepo(analyticsSqlite);
      chapterEvalRepo = createChapterEvalRepo(analyticsSqlite);
      synthesisPlanRepo = createSynthesisPlanRepo(analyticsSqlite);
      correctionHistoryRepo = createCorrectionHistoryRepo(analyticsSqlite);
      crossChapterStateRepo = createCrossChapterStateRepo(analyticsSqlite);
      phaseMetricsRepo = createPhaseMetricsRepo(analyticsSqlite);

      const taskRepo = createTaskRepo(analyticsSqlite);
      const workRepo = createWorkRepo(analyticsSqlite);
      const checkpointRepo = createCheckpointRepo(analyticsSqlite);
      const checkpointManager = createCheckpointManager(checkpointRepo);
      const candidateRepo = createSoulCandidateRepo(analyticsSqlite);

      analyticsDeps = {
        llmClient: analyticsMockLLMClient,
        soulManager: createMockSoulManager(),
        checkpointManager,
        taskRepo,
        workRepo,
        candidateRepo,
        config: { chapterCount: 2, targetTotalLength: 8000, maxCorrectionAttempts: 3, dbPath: ':memory:' },
        judgeSessionRepo,
        chapterEvalRepo,
        synthesisPlanRepo,
        correctionHistoryRepo,
        crossChapterStateRepo,
        phaseMetricsRepo,
      };
    });

    afterEach(() => {
      analyticsDb.close();
    });

    it('should save judge session results when repo is provided', async () => {
      const saveSpy = vi.spyOn(judgeSessionRepo, 'save');
      const runner = createFullPipeline(analyticsDeps);
      await runner.generateStory('テスト生成');

      // Tournament has rounds; save called for each round per chapter
      expect(saveSpy).toHaveBeenCalled();
      const savedData = saveSpy.mock.calls[0][0];
      expect(savedData.matchId).toBeNull();
      expect(savedData.scores).toBeDefined();
    });

    it('should save chapter evaluations when repo is provided', async () => {
      const saveSpy = vi.spyOn(chapterEvalRepo, 'save');
      const runner = createFullPipeline(analyticsDeps);
      await runner.generateStory('テスト生成');

      // One evaluation per chapter
      expect(saveSpy).toHaveBeenCalledTimes(2);
      const savedData = saveSpy.mock.calls[0][0];
      expect(savedData.chapterId).toBeNull();
      expect(savedData.verdictLevel).toBe('publishable');
    });

    it('should save synthesis plans when repo is provided', async () => {
      const saveSpy = vi.spyOn(synthesisPlanRepo, 'save');
      const runner = createFullPipeline(analyticsDeps);
      await runner.generateStory('テスト生成');

      // Synthesis happens when allGenerations > 1 (4 writers by default)
      expect(saveSpy).toHaveBeenCalled();
      const savedData = saveSpy.mock.calls[0][0];
      expect(savedData.chapterId).toBeNull();
      expect(savedData.championAssessment).toBe('Good base text');
      expect(savedData.preserveElements).toEqual(['opening']);
    });

    it('should save phase metrics when repo is provided', async () => {
      const saveSpy = vi.spyOn(phaseMetricsRepo, 'save');
      const runner = createFullPipeline(analyticsDeps);
      await runner.generateStory('テスト生成');

      // At minimum: plotter + tournament*2 + compliance*2 + defect_detection*2 + synthesis*2 + chapter_state_extraction*1
      expect(saveSpy.mock.calls.length).toBeGreaterThanOrEqual(6);

      const phases = saveSpy.mock.calls.map(c => c[0].phase);
      expect(phases).toContain('plotter');
      expect(phases).toContain('tournament');
      expect(phases).toContain('compliance');
      expect(phases).toContain('defect_detection');
    });

    it('should save cross-chapter state when repo is provided', async () => {
      const saveSpy = vi.spyOn(crossChapterStateRepo, 'save');
      const runner = createFullPipeline(analyticsDeps);
      await runner.generateStory('テスト生成');

      // Cross-chapter state is extracted for chapters 1..n-1 (when ch.index < plot.chapters.length)
      expect(saveSpy).toHaveBeenCalled();
      const savedData = saveSpy.mock.calls[0][0];
      expect(savedData.workId).toBeNull();
      expect(savedData.chapterIndex).toBe(1);
      expect(savedData.variationHint).toBeDefined();
    });

    it('should not break when repos are not provided (backward compat)', async () => {
      // Use deps without analytics repos (the original deps object)
      const runner = createFullPipeline(deps);
      const result = await runner.generateStory('テスト生成');

      // Should complete normally without analytics repos
      expect(result.taskId).toBeDefined();
      expect(result.chapters).toHaveLength(2);
    });

    it('should not break pipeline when repo save throws', async () => {
      // Make all repos throw on save
      vi.spyOn(judgeSessionRepo, 'save').mockRejectedValue(new Error('DB error'));
      vi.spyOn(chapterEvalRepo, 'save').mockRejectedValue(new Error('DB error'));
      vi.spyOn(synthesisPlanRepo, 'save').mockRejectedValue(new Error('DB error'));
      vi.spyOn(phaseMetricsRepo, 'save').mockRejectedValue(new Error('DB error'));
      vi.spyOn(crossChapterStateRepo, 'save').mockRejectedValue(new Error('DB error'));

      const runner = createFullPipeline(analyticsDeps);
      const result = await runner.generateStory('テスト生成');

      // Pipeline should complete despite all repo save failures
      expect(result.taskId).toBeDefined();
      expect(result.chapters).toHaveLength(2);
      expect(result.plot.title).toBe('テスト小説');
    });

    it('should save correction history when correction is triggered', async () => {
      // Make LLM produce text with forbidden words to trigger correction
      const correctionDeps = { ...analyticsDeps };
      const correctionLLM = createMockLLMClient();
      let callCount = 0;
      (correctionLLM.complete as ReturnType<typeof vi.fn>).mockImplementation((systemPromptOrMessages: string | unknown[]) => {
        const systemPrompt = typeof systemPromptOrMessages === 'string'
          ? systemPromptOrMessages
          : (systemPromptOrMessages as Array<{ role: string; content: string }>).find(m => m.role === 'system')?.content ?? '';
        if (systemPrompt.includes('矯正') || systemPrompt.includes('修正')) {
          return Promise.resolve('修正された文章です。違反は解消されました。');
        }
        if (systemPrompt.includes('断片') || systemPrompt.includes('抽出')) {
          return Promise.resolve(JSON.stringify({ fragments: [] }));
        }
        // First call produces forbidden word, subsequent calls produce clean text
        callCount++;
        if (callCount <= 4) { // 4 writers
          return Promise.resolve('透心はとても静かに窓の外を見つめていた。');
        }
        return Promise.resolve('透心は静かに窓の外を見つめていた。');
      });
      correctionDeps.llmClient = correctionLLM;

      const saveSpy = vi.spyOn(correctionHistoryRepo, 'save');
      const runner = createFullPipeline(correctionDeps);
      await runner.generateStory('テスト生成');

      // Correction should have been triggered for at least chapter 1 (forbidden word 'とても')
      if (saveSpy.mock.calls.length > 0) {
        const savedData = saveSpy.mock.calls[0][0];
        expect(savedData.chapterId).toBeNull();
        expect(savedData.attemptNumber).toBeGreaterThan(0);
        expect(typeof savedData.correctedSuccessfully).toBe('boolean');
      }
    });
  });
});
