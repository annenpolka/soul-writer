import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { SoulTextManager } from '../soul/manager.js';
import type { TaskRepository } from '../storage/task-repository.js';
import type { WorkRepository } from '../storage/work-repository.js';
import type { CheckpointManager } from '../storage/checkpoint-manager.js';
import type { SoulCandidateRepository } from '../storage/soul-candidate-repository.js';
import type { FactoryConfig } from '../schemas/factory-config.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import type { FullPipelineResult } from '../agents/types.js';
import { ThemeGeneratorAgent, type ThemeResult } from './theme-generator.js';
import { FullPipeline } from '../pipeline/full.js';
import { FileWriter } from './file-writer.js';

export interface BatchResult {
  totalTasks: number;
  completed: number;
  failed: number;
  skipped: number;
  totalTokensUsed: number;
  results: TaskResult[];
}

export interface TaskResult {
  taskId: string;
  themeId: string;
  status: 'completed' | 'failed' | 'skipped';
  error?: string;
  tokensUsed?: number;
  complianceScore?: number;
  readerScore?: number;
  emotion?: string;
  timeline?: string;
}

export interface ProgressInfo {
  current: number;
  total: number;
  status: 'completed' | 'failed';
  themeId: string;
}

export interface BatchDependencies {
  soulText: SoulText;
  llmClient: LLMClient;
  taskRepo: TaskRepository;
  workRepo: WorkRepository;
  checkpointManager: CheckpointManager;
  candidateRepo: SoulCandidateRepository;
}

// Interfaces for dependency injection (testing)
export interface ThemeGenerator {
  generateTheme(recentThemes?: GeneratedTheme[]): Promise<ThemeResult>;
}

export interface PipelineInstance {
  generateStory(prompt: string): Promise<FullPipelineResult>;
}

export interface StoryFileWriter {
  writeStory(result: FullPipelineResult, theme: GeneratedTheme): string;
}

export interface BatchRunnerOptions {
  themeGenerator?: ThemeGenerator;
  pipelineFactory?: (theme: GeneratedTheme) => PipelineInstance;
  fileWriter?: StoryFileWriter;
}

/**
 * Runs batch generation of stories with random themes
 */
export class BatchRunner {
  private config: FactoryConfig;
  private deps: BatchDependencies;
  private options: BatchRunnerOptions;

  constructor(config: FactoryConfig, deps: BatchDependencies, options: BatchRunnerOptions = {}) {
    this.config = config;
    this.deps = deps;
    this.options = options;
  }

  /**
   * Run batch generation with parallel execution
   * @param onProgress Optional callback for progress updates
   */
  async run(onProgress?: (info: ProgressInfo) => void): Promise<BatchResult> {
    const results: TaskResult[] = new Array(this.config.count);
    let totalTokensUsed = 0;
    let completed = 0;
    let failed = 0;

    // Use injected dependencies or create defaults
    const themeGenerator = this.options.themeGenerator ??
      new ThemeGeneratorAgent(this.deps.llmClient, this.deps.soulText);

    const fileWriter = this.options.fileWriter ??
      new FileWriter(this.config.outputDir);

    const createPipeline = this.options.pipelineFactory ?? ((theme: GeneratedTheme) => {
      const mockSoulManager = {
        getSoulText: () => this.deps.soulText,
        getConstitution: () => this.deps.soulText.constitution,
      } as SoulTextManager;

      return new FullPipeline(
        this.deps.llmClient,
        mockSoulManager,
        this.deps.checkpointManager,
        this.deps.taskRepo,
        this.deps.workRepo,
        this.deps.candidateRepo,
        { chapterCount: this.config.chaptersPerStory }
      );
    });

    // Shared queue for worker pool pattern
    const queue: number[] = Array.from({ length: this.config.count }, (_, i) => i);
    let progressCount = 0;

    // History-based avoidance: track recent themes across all workers
    const recentThemes: GeneratedTheme[] = [];
    const MAX_RECENT_THEMES = 10;

    // Execute a single task
    const executeTask = async (taskIndex: number): Promise<TaskResult> => {
      const themeId = `theme_${Date.now()}_${taskIndex}`;

      try {
        // Generate theme with history avoidance
        const themeResult = await themeGenerator.generateTheme([...recentThemes]);

        // Create pipeline and generate story
        const pipeline = createPipeline(themeResult.theme);
        const storyResult = await pipeline.generateStory(themeResult.theme.premise);

        // Write to file
        fileWriter.writeStory(storyResult, themeResult.theme);

        // Track theme for history-based avoidance
        recentThemes.push(themeResult.theme);
        if (recentThemes.length > MAX_RECENT_THEMES) {
          recentThemes.shift();
        }

        return {
          taskId: storyResult.taskId,
          themeId,
          status: 'completed',
          tokensUsed: themeResult.tokensUsed + storyResult.totalTokensUsed,
          complianceScore: storyResult.avgComplianceScore,
          readerScore: storyResult.avgReaderScore,
          emotion: themeResult.theme.emotion,
          timeline: themeResult.theme.timeline,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          taskId: '',
          themeId,
          status: 'failed',
          error: errorMessage,
        };
      }
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Worker slot function - pulls from queue until empty
    const runSlot = async (): Promise<void> => {
      let isFirst = true;
      while (true) {
        const taskIndex = queue.shift();
        if (taskIndex === undefined) break;

        // Throttle between tasks (skip delay for first task in slot)
        if (!isFirst && this.config.taskDelayMs > 0) {
          await delay(this.config.taskDelayMs);
        }
        isFirst = false;

        const result = await executeTask(taskIndex);
        results[taskIndex] = result;

        // Update aggregates
        if (result.status === 'completed') {
          completed++;
          totalTokensUsed += result.tokensUsed ?? 0;
        } else {
          failed++;
        }

        progressCount++;
        onProgress?.({
          current: progressCount,
          total: this.config.count,
          status: result.status === 'completed' ? 'completed' : 'failed',
          themeId: result.themeId,
        });
      }
    };

    // Run N slots in parallel
    const slotCount = Math.min(this.config.parallel, this.config.count);
    await Promise.all(Array.from({ length: slotCount }, () => runSlot()));

    return {
      totalTasks: this.config.count,
      completed,
      failed,
      skipped: 0,
      totalTokensUsed,
      results: results.filter(Boolean),
    };
  }
}
