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
  generateTheme(): Promise<ThemeResult>;
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
   * Run batch generation
   * @param onProgress Optional callback for progress updates
   */
  async run(onProgress?: (info: ProgressInfo) => void): Promise<BatchResult> {
    const results: TaskResult[] = [];
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

    for (let i = 0; i < this.config.count; i++) {
      const themeId = `theme_${Date.now()}_${i}`;

      try {
        // Generate theme
        const themeResult = await themeGenerator.generateTheme();
        totalTokensUsed += themeResult.tokensUsed;

        // Create pipeline and generate story
        const pipeline = createPipeline(themeResult.theme);
        const storyResult = await pipeline.generateStory(themeResult.theme.premise);
        totalTokensUsed += storyResult.totalTokensUsed;

        // Write to file
        fileWriter.writeStory(storyResult, themeResult.theme);

        results.push({
          taskId: storyResult.taskId,
          themeId,
          status: 'completed',
          tokensUsed: themeResult.tokensUsed + storyResult.totalTokensUsed,
        });

        completed++;

        onProgress?.({
          current: i + 1,
          total: this.config.count,
          status: 'completed',
          themeId,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        results.push({
          taskId: '',
          themeId,
          status: 'failed',
          error: errorMessage,
        });

        failed++;

        onProgress?.({
          current: i + 1,
          total: this.config.count,
          status: 'failed',
          themeId,
        });
      }
    }

    return {
      totalTasks: this.config.count,
      completed,
      failed,
      skipped: 0,
      totalTokensUsed,
      results,
    };
  }
}
