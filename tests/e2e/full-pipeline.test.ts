/**
 * E2E Integration Test
 * Tests the complete pipeline from plot generation through learning
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlotterAgent } from '../../src/agents/plotter.js';
import { ComplianceChecker } from '../../src/compliance/checker.js';
import { CorrectorAgent } from '../../src/agents/corrector.js';
import { CorrectionLoop } from '../../src/correction/loop.js';
import { FragmentExtractor } from '../../src/learning/fragment-extractor.js';
import { SoulExpander } from '../../src/learning/soul-expander.js';
import { LearningPipeline } from '../../src/learning/learning-pipeline.js';
import { DatabaseConnection } from '../../src/storage/database.js';
import { WorkRepository } from '../../src/storage/work-repository.js';
import { TaskRepository } from '../../src/storage/task-repository.js';
import { CheckpointRepository } from '../../src/storage/checkpoint-repository.js';
import { CheckpointManager } from '../../src/storage/checkpoint-manager.js';
import { SoulCandidateRepository } from '../../src/storage/soul-candidate-repository.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';

// Mock LLM that returns appropriate responses
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
            ],
          })
        );
      }

      // Corrector response
      if (systemPrompt.includes('矯正') || systemPrompt.includes('修正')) {
        return Promise.resolve('修正された文章です。違反は解消されました。');
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

      // Default response
      return Promise.resolve('透心は静かに窓の外を見つめていた。');
    }),
    getTotalTokens: vi.fn().mockReturnValue(100),
  };
};

const mockSoulText: SoulText = {
  constitution: {
    meta: { soul_id: 'e2e-test', soul_name: 'E2E Test Soul', version: '1.0.0', created_at: '', updated_at: '' },
    sentence_structure: {
      rhythm_pattern: 'test',
      taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
      typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
    },
    vocabulary: {
      bracket_notations: [],
      forbidden_words: ['とても', '非常に'],
      characteristic_expressions: [],
      special_marks: { mark: '×', usage: 'test', forms: ['×した', '×される'] },
    },
    rhetoric: {
      simile_base: 'test',
      metaphor_density: 'low',
      forbidden_similes: ['天使のような'],
      personification_allowed_for: [],
    },
    narrative: {
      default_pov: 'test',
      pov_by_character: {},
      default_tense: 'test',
      tense_shift_allowed: 'test',
      dialogue_ratio: 'test',
      dialogue_style_by_character: {},
    },
    thematic_constraints: {
      must_preserve: [],
      forbidden_resolutions: [],
    },
  },
  worldBible: {
    technology: {},
    society: {},
    characters: {},
    terminology: {},
    locations: {},
  },
  antiSoul: {
    categories: {
      theme_violation: [],
      excessive_sentiment: [],
      explanatory_worldbuilding: [],
      character_normalization: [],
      cliche_simile: [],
    },
  },
  readerPersonas: {
    personas: [
      {
        id: 'test-persona',
        name: 'テスト読者',
        description: 'テスト用ペルソナ',
        preferences: ['style', 'plot'],
        evaluation_weights: {
          style: 1.0,
          plot: 1.0,
          character: 1.0,
          worldbuilding: 1.0,
          readability: 1.0,
        },
      },
    ],
  },
  fragments: new Map(),
};

describe('E2E: Full Pipeline Integration', () => {
  let db: DatabaseConnection;
  let mockLLMClient: LLMClient;

  beforeEach(() => {
    db = new DatabaseConnection();
    db.runMigrations();
    mockLLMClient = createMockLLMClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  describe('Complete Story Generation Flow', () => {
    it('should generate plot, archive work, and extract learning fragments', async () => {
      // 1. Create repositories
      const workRepo = new WorkRepository(db);
      const taskRepo = new TaskRepository(db);
      const checkpointRepo = new CheckpointRepository(db);
      const candidateRepo = new SoulCandidateRepository(db);
      const checkpointManager = new CheckpointManager(checkpointRepo);

      // 2. Create and start task
      const task = await taskRepo.create({
        soulId: 'e2e-test',
        params: { prompt: 'テスト生成', chapters: 1 },
      });
      await taskRepo.markStarted(task.id);

      // 3. Generate plot
      const plotter = new PlotterAgent(mockLLMClient, mockSoulText);
      const plotResult = await plotter.generatePlot('テスト生成', { chapterCount: 1, targetTotalLength: 4000 });

      expect(plotResult.plot.title).toBe('テスト小説');
      expect(plotResult.plot.chapters).toHaveLength(1);

      // Save checkpoint
      await checkpointManager.saveCheckpoint(task.id, 'plot_generation', { plot: plotResult.plot });

      // 4. Check compliance on sample text
      const sampleText = '透心は静かに窓の外を見つめていた。ARタグが揺らめく朝の光の中で。';
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const complianceResult = checker.check(sampleText);

      expect(complianceResult.isCompliant).toBe(true);
      expect(complianceResult.score).toBe(1);

      // 5. Archive the work
      const work = await workRepo.create({
        soulId: 'e2e-test',
        title: plotResult.plot.title,
        content: sampleText,
        totalChapters: 1,
        totalTokens: mockLLMClient.getTotalTokens(),
        complianceScore: complianceResult.score,
        readerScore: 0.88,
      });

      expect(work.id).toBeDefined();

      // 6. Extract learning fragments
      const extractor = new FragmentExtractor(mockLLMClient);
      const expander = new SoulExpander(candidateRepo);
      const learningPipeline = new LearningPipeline(extractor, expander);

      const learningResult = await learningPipeline.process({
        soulId: 'e2e-test',
        workId: work.id,
        text: sampleText,
        complianceScore: complianceResult.score,
        readerScore: 0.88,
      });

      expect(learningResult.skipped).toBe(false);
      expect(learningResult.extracted).toBeGreaterThanOrEqual(0);

      // 7. Mark task complete
      await taskRepo.markCompleted(task.id);
      const completedTask = await taskRepo.findById(task.id);
      expect(completedTask?.status).toBe('completed');
    });
  });

  describe('Compliance and Correction Flow', () => {
    it('should detect violations and attempt correction', async () => {
      // Text with forbidden word
      const violatingText = 'とても美しい朝だった。';

      // Check compliance
      const checker = ComplianceChecker.fromSoulText(mockSoulText);
      const result = checker.check(violatingText);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('forbidden_word');

      // Run correction loop
      const corrector = new CorrectorAgent(mockLLMClient, mockSoulText);
      const loop = new CorrectionLoop(corrector, checker, 3);

      const correctionResult = await loop.run(violatingText);

      // The mock corrector returns compliant text
      expect(correctionResult.attempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Checkpoint and Resume Flow', () => {
    it('should save and restore checkpoints', async () => {
      const taskRepo = new TaskRepository(db);
      const checkpointRepo = new CheckpointRepository(db);
      const checkpointManager = new CheckpointManager(checkpointRepo);

      // Create task
      const task = await taskRepo.create({
        soulId: 'e2e-test',
        params: { prompt: 'チェックポイントテスト', chapters: 3 },
      });

      // Save checkpoint at chapter 2
      await checkpointManager.saveCheckpoint(
        task.id,
        'chapter_start',
        { completedChapters: ['Chapter 1 content'] },
        { currentChapter: 2, totalChapters: 3 }
      );

      // Verify checkpoint can be retrieved
      const canResume = await checkpointManager.canResume(task.id);
      expect(canResume).toBe(true);

      const resumeState = await checkpointManager.getResumeState(task.id);
      expect(resumeState?._phase).toBe('chapter_start');
      expect(resumeState?._progress.currentChapter).toBe(2);
    });
  });

  describe('Learning Pipeline Flow', () => {
    it('should skip learning for low-quality text', async () => {
      const workRepo = new WorkRepository(db);
      const candidateRepo = new SoulCandidateRepository(db);
      const expander = new SoulExpander(candidateRepo);
      const extractor = new FragmentExtractor(mockLLMClient);
      const learningPipeline = new LearningPipeline(extractor, expander);

      // Create a low-quality work
      const work = await workRepo.create({
        soulId: 'e2e-test',
        title: 'Low Quality',
        content: 'Low quality content',
        totalChapters: 1,
        totalTokens: 100,
        complianceScore: 0.6, // Below threshold
        readerScore: 0.5,
      });

      // Run learning pipeline
      const result = await learningPipeline.process({
        soulId: 'e2e-test',
        workId: work.id,
        text: work.content,
        complianceScore: work.complianceScore!,
        readerScore: work.readerScore!,
      });

      // Should be skipped due to low scores
      expect(result.skipped).toBe(true);
    });

    it('should extract and store candidates from high-quality text', async () => {
      const workRepo = new WorkRepository(db);
      const candidateRepo = new SoulCandidateRepository(db);
      const expander = new SoulExpander(candidateRepo);
      const extractor = new FragmentExtractor(mockLLMClient);
      const learningPipeline = new LearningPipeline(extractor, expander);

      // Create a high-quality work
      const work = await workRepo.create({
        soulId: 'e2e-test',
        title: 'High Quality',
        content: '透心は静かに窓の外を見つめていた。',
        totalChapters: 1,
        totalTokens: 100,
        complianceScore: 0.95,
        readerScore: 0.88,
      });

      // Run learning pipeline
      const result = await learningPipeline.process({
        soulId: 'e2e-test',
        workId: work.id,
        text: work.content,
        complianceScore: work.complianceScore!,
        readerScore: work.readerScore!,
      });

      // Should not be skipped
      expect(result.skipped).toBe(false);
    });
  });
});
