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
import { CharacterDeveloperAgent, type CharacterDevelopResult, type DevelopedCharacters } from './character-developer.js';
import { CharacterMacGuffinAgent } from './character-macguffin.js';
import { PlotMacGuffinAgent } from './plot-macguffin.js';
import type { CharacterMacGuffin, PlotMacGuffin } from '../schemas/macguffin.js';
import { FullPipeline } from '../pipeline/full.js';
import { MotifAnalyzerAgent } from './motif-analyzer.js';
import { FileWriter } from './file-writer.js';
import { Logger } from '../logger.js';

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
  tone?: string;
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
  generateTheme(recentThemes?: GeneratedTheme[], motifAvoidance?: string[]): Promise<ThemeResult>;
}

export interface CharacterDeveloper {
  develop(theme: GeneratedTheme): Promise<CharacterDevelopResult>;
}

export interface PipelineInstance {
  generateStory(prompt: string): Promise<FullPipelineResult>;
}

export interface StoryFileWriter {
  writeStory(result: FullPipelineResult, theme: GeneratedTheme): string;
}

export interface BatchRunnerOptions {
  themeGenerator?: ThemeGenerator;
  characterDeveloper?: CharacterDeveloper;
  pipelineFactory?: (theme: GeneratedTheme, developed?: DevelopedCharacters, logger?: Logger, charMacGuffins?: CharacterMacGuffin[], plotMacGuffins?: PlotMacGuffin[]) => PipelineInstance;
  fileWriter?: StoryFileWriter;
  verbose?: boolean;
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

    const characterDeveloper = this.options.characterDeveloper ??
      new CharacterDeveloperAgent(this.deps.llmClient, this.deps.soulText);

    const fileWriter = this.options.fileWriter ??
      new FileWriter(this.config.outputDir);

    const createPipeline = this.options.pipelineFactory ?? ((theme: GeneratedTheme, developed?: DevelopedCharacters, logger?: Logger, charMG?: CharacterMacGuffin[], plotMG?: PlotMacGuffin[]) => {
      const mockSoulManager = {
        getSoulText: () => this.deps.soulText,
        getConstitution: () => this.deps.soulText.constitution,
        getWriterPersonas: () => this.deps.soulText.writerPersonas ?? [],
        getPromptConfig: () => this.deps.soulText.promptConfig,
      } as SoulTextManager;

      return new FullPipeline(
        this.deps.llmClient,
        mockSoulManager,
        this.deps.checkpointManager,
        this.deps.taskRepo,
        this.deps.workRepo,
        this.deps.candidateRepo,
        {
          chapterCount: this.config.chaptersPerStory,
          narrativeType: theme.narrative_type,
          developedCharacters: developed?.characters,
          theme,
          characterMacGuffins: charMG,
          plotMacGuffins: plotMG,
          mode: this.config.mode === 'collaboration' ? 'collaboration' : undefined,
        },
        logger,
      );
    });

    // Shared queue for worker pool pattern
    const queue: number[] = Array.from({ length: this.config.count }, (_, i) => i);
    let progressCount = 0;

    // History-based avoidance: track recent themes across all workers
    const recentThemes: GeneratedTheme[] = [];
    const MAX_RECENT_THEMES = 10;

    // DB-based motif avoidance (0 = disabled)
    let dbMotifAvoidance: string[] = [];
    if (this.config.motifAnalysisCount > 0) {
      const soulId = this.deps.soulText.constitution.meta.soul_id;
      const recentWorks = await this.deps.workRepo.findRecentBySoulId(soulId, this.config.motifAnalysisCount);
      if (recentWorks.length > 0) {
        const analyzer = new MotifAnalyzerAgent(this.deps.llmClient);
        const analysis = await analyzer.analyze(recentWorks);
        dbMotifAvoidance = analysis.frequentMotifs;
        totalTokensUsed += analysis.tokensUsed;
      }
    }

    // Execute a single task
    const verbose = this.options.verbose ?? false;

    const executeTask = async (taskIndex: number): Promise<TaskResult> => {
      const themeId = `theme_${Date.now()}_${taskIndex}`;
      const logger = verbose
        ? new Logger({ verbose: true, logFile: `${this.config.outputDir}/logs/story-${taskIndex}.log` })
        : undefined;

      try {
        // Generate theme with history avoidance
        const themeResult = await themeGenerator.generateTheme([...recentThemes], dbMotifAvoidance);
        logger?.debug('Theme generated', themeResult.theme);

        // Generate character MacGuffins
        const charMacGuffinAgent = new CharacterMacGuffinAgent(this.deps.llmClient, this.deps.soulText);
        const charMacGuffinResult = await charMacGuffinAgent.generate(themeResult.theme);
        const charMacGuffins: CharacterMacGuffin[] = charMacGuffinResult.macguffins;
        logger?.debug('Character MacGuffins generated', charMacGuffins);

        // Develop characters for this theme (with MacGuffins)
        const charResult = await characterDeveloper.develop(themeResult.theme, charMacGuffins);
        logger?.debug('Characters developed', charResult.developed);

        // Generate plot MacGuffins
        const plotMacGuffinAgent = new PlotMacGuffinAgent(this.deps.llmClient, this.deps.soulText);
        const plotMacGuffinResult = await plotMacGuffinAgent.generate(themeResult.theme, charMacGuffins);
        const plotMacGuffins: PlotMacGuffin[] = plotMacGuffinResult.macguffins;
        logger?.debug('Plot MacGuffins generated', plotMacGuffins);

        // Create pipeline and generate story
        const pipeline = createPipeline(themeResult.theme, charResult.developed, logger, charMacGuffins, plotMacGuffins);
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
          tokensUsed: themeResult.tokensUsed + charResult.tokensUsed + storyResult.totalTokensUsed,
          complianceScore: storyResult.avgComplianceScore,
          readerScore: storyResult.avgReaderScore,
          emotion: themeResult.theme.emotion,
          timeline: themeResult.theme.timeline,
          tone: themeResult.theme.tone,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.debug('Task failed', { error: errorMessage });
        return {
          taskId: '',
          themeId,
          status: 'failed',
          error: errorMessage,
        };
      } finally {
        logger?.close();
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
