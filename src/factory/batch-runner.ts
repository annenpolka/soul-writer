import type { LLMClient } from '../llm/types.js';
import type { SoulText, SoulTextManagerFn } from '../soul/manager.js';
import type { TaskRepo } from '../storage/task-repository.js';
import type { WorkRepo } from '../storage/work-repository.js';
import type { CheckpointManagerFn } from '../storage/checkpoint-manager.js';
import type { SoulCandidateRepo } from '../storage/soul-candidate-repository.js';
import type { FactoryConfig } from '../schemas/factory-config.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import type { FullPipelineResult } from '../agents/types.js';
import { createThemeGenerator, type ThemeResult } from './theme-generator.js';
import { createCharacterDeveloper, type CharacterDevelopResult, type DevelopedCharacters } from './character-developer.js';
import { createCharacterMacGuffinAgent } from './character-macguffin.js';
import { createPlotMacGuffinAgent } from './plot-macguffin.js';
import type { CharacterMacGuffin, PlotMacGuffin } from '../schemas/macguffin.js';
import { createFullPipeline } from '../pipeline/full.js';
import { createMotifAnalyzer } from './motif-analyzer.js';
import { createCharacterEnricher } from './character-enricher.js';
import type { EnrichedCharacterPhase1 } from './character-enricher.js';
import { createFileWriter } from './file-writer.js';
import { createLogger } from '../logger.js';
import type { LoggerFn } from '../logger.js';

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
  compliancePass?: boolean;
  verdictLevel?: string;
  emotion?: string;
  timeline?: string;
  tone?: string;
}

export interface ProgressInfo {
  current: number;
  total: number;
  status: 'completed' | 'failed';
  themeId: string;
  message?: string;
}

export interface BatchDependencies {
  soulText: SoulText;
  llmClient: LLMClient;
  taskRepo: TaskRepo;
  workRepo: WorkRepo;
  checkpointManager: CheckpointManagerFn;
  candidateRepo: SoulCandidateRepo;
}

// Interfaces for dependency injection (testing)
export interface ThemeGenerator {
  generateTheme(recentThemes?: GeneratedTheme[], motifAvoidance?: string[]): Promise<ThemeResult>;
}

export interface CharacterDeveloper {
  develop(theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Promise<CharacterDevelopResult>;
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
  pipelineFactory?: (theme: GeneratedTheme, developed?: DevelopedCharacters, logger?: LoggerFn, charMacGuffins?: CharacterMacGuffin[], plotMacGuffins?: PlotMacGuffin[], enrichedChars?: EnrichedCharacterPhase1[]) => PipelineInstance;
  fileWriter?: StoryFileWriter;
  verbose?: boolean;
}

// --- FP interface ---

export interface BatchRunnerFn {
  run: (onProgress?: (info: ProgressInfo) => void) => Promise<BatchResult>;
}

// --- Factory function ---

export function createBatchRunner(
  config: FactoryConfig,
  deps: BatchDependencies,
  options: BatchRunnerOptions = {},
): BatchRunnerFn {

  const run = async (onProgress?: (info: ProgressInfo) => void): Promise<BatchResult> => {
    const results: TaskResult[] = new Array(config.count);
    let totalTokensUsed = 0;
    let completed = 0;
    let failed = 0;

    // Use injected dependencies or create defaults
    const themeGenerator = options.themeGenerator ??
      createThemeGenerator(deps.llmClient, deps.soulText);

    const characterDeveloper = options.characterDeveloper ??
      createCharacterDeveloper(deps.llmClient, deps.soulText);

    const fileWriter = options.fileWriter ??
      createFileWriter(config.outputDir);

    const createPipeline = options.pipelineFactory ?? ((theme: GeneratedTheme, developed?: DevelopedCharacters, logger?: LoggerFn, charMG?: CharacterMacGuffin[], plotMG?: PlotMacGuffin[], enrichedChars?: EnrichedCharacterPhase1[]) => {
      const mockSoulManager = {
        getSoulText: () => deps.soulText,
        getConstitution: () => deps.soulText.constitution,
        getWorldBible: () => deps.soulText.worldBible,
        getAntiSoul: () => deps.soulText.antiSoul,
        getReaderPersonas: () => deps.soulText.readerPersonas,
        getFragmentsForCategory: (category: string) => deps.soulText.fragments.get(category) ?? [],
        getAllFragments: () => deps.soulText.fragments,
        getPromptConfig: () => deps.soulText.promptConfig,
        getWriterPersonas: () => deps.soulText.writerPersonas ?? [],
        getCollabPersonas: () => deps.soulText.writerPersonas?.slice(0, 3) ?? [],
        getRawSoultext: () => deps.soulText.rawSoultext,
        clearRawSoultext: () => {},
        buildSystemPrompt: () => '',
      } as SoulTextManagerFn;

      return createFullPipeline({
        llmClient: deps.llmClient,
        soulManager: mockSoulManager,
        checkpointManager: deps.checkpointManager,
        taskRepo: deps.taskRepo,
        workRepo: deps.workRepo,
        candidateRepo: deps.candidateRepo,
        config: {
          chapterCount: config.chaptersPerStory,
          narrativeType: theme.narrative_type,
          developedCharacters: developed?.characters,
          enrichedCharacters: enrichedChars,
          theme,
          characterMacGuffins: charMG,
          plotMacGuffins: plotMG,
          motifAvoidanceList: dbMotifAvoidance.length > 0 ? dbMotifAvoidance : undefined,
          mode: config.mode === 'collaboration' ? 'collaboration' : undefined,
        },
        logger,
      });
    });

    // Shared queue for worker pool pattern
    const queue: number[] = Array.from({ length: config.count }, (_, i) => i);
    let progressCount = 0;

    // History-based avoidance: track recent themes across all workers
    const recentThemes: GeneratedTheme[] = [];
    const MAX_RECENT_THEMES = 10;

    // DB-based motif avoidance (0 = disabled)
    let dbMotifAvoidance: string[] = [];
    if (config.motifAnalysisCount > 0) {
      const soulId = deps.soulText.constitution.meta.soul_id;
      const recentWorks = await deps.workRepo.findRecentBySoulId(soulId, config.motifAnalysisCount);
      if (recentWorks.length > 0) {
        const analyzer = createMotifAnalyzer(deps.llmClient);
        const analysis = await analyzer.analyze(recentWorks);
        dbMotifAvoidance = analysis.frequentMotifs;
        totalTokensUsed += analysis.tokensUsed;
      }
    }

    // Execute a single task
    const verbose = options.verbose ?? false;

    const executeTask = async (taskIndex: number): Promise<TaskResult> => {
      const themeId = `theme_${Date.now()}_${taskIndex}`;
      const logger = verbose
        ? createLogger({ verbose: true, logFile: `${config.outputDir}/logs/story-${taskIndex}.log` })
        : undefined;

      try {
        // Generate theme with history avoidance
        const themeResult = await themeGenerator.generateTheme([...recentThemes], dbMotifAvoidance);
        logger?.debug('Theme generated', themeResult.theme);

        // Generate character MacGuffins
        const charMacGuffinAgent = createCharacterMacGuffinAgent(deps.llmClient, deps.soulText);
        const charMacGuffinResult = await charMacGuffinAgent.generate(themeResult.theme);
        const charMacGuffins: CharacterMacGuffin[] = charMacGuffinResult.macguffins;
        logger?.debug('Character MacGuffins generated', charMacGuffins);

        // Develop characters for this theme (with MacGuffins)
        const charResult = await characterDeveloper.develop(themeResult.theme, charMacGuffins);
        logger?.debug('Characters developed', charResult.developed);

        // Enrich characters with physical habits and stance (Phase1)
        const enricher = createCharacterEnricher(deps.llmClient, deps.soulText);
        const phase1Result = await enricher.enrichPhase1(charResult.developed.characters, themeResult.theme);
        logger?.debug('Characters enriched (Phase1)', phase1Result.characters);

        // Generate plot MacGuffins
        const plotMacGuffinAgent = createPlotMacGuffinAgent(deps.llmClient, deps.soulText);
        const plotMacGuffinResult = await plotMacGuffinAgent.generate(themeResult.theme, charMacGuffins);
        const plotMacGuffins: PlotMacGuffin[] = plotMacGuffinResult.macguffins;
        logger?.debug('Plot MacGuffins generated', plotMacGuffins);

        // Create pipeline and generate story
        const pipeline = createPipeline(themeResult.theme, charResult.developed, logger, charMacGuffins, plotMacGuffins, phase1Result.characters);
        const storyResult = await pipeline.generateStory(themeResult.theme.premise);

        // Write to file
        fileWriter.writeStory(storyResult, themeResult.theme);

        // Track theme for history-based avoidance
        recentThemes.push(themeResult.theme);
        if (recentThemes.length > MAX_RECENT_THEMES) {
          recentThemes.shift();
        }

        // Determine primary verdict level from distribution
        const primaryVerdict = storyResult.verdictDistribution
          ? Object.entries(storyResult.verdictDistribution).sort((a, b) => b[1] - a[1])[0]?.[0]
          : undefined;

        return {
          taskId: storyResult.taskId,
          themeId,
          status: 'completed',
          tokensUsed: themeResult.tokensUsed + charResult.tokensUsed + phase1Result.tokensUsed + storyResult.totalTokensUsed,
          compliancePass: storyResult.compliancePassRate >= 1.0,
          verdictLevel: primaryVerdict,
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

    // Global consecutive failure tracking for emergency stop
    let globalConsecutiveFailures = 0;
    let emergencyStopped = false;
    const maxConsecutiveFailures = config.maxConsecutiveFailures ?? 20;

    // Worker slot function - pulls from queue until empty
    const runSlot = async (): Promise<void> => {
      let isFirst = true;
      let consecutiveSlotFailures = 0;
      while (true) {
        if (emergencyStopped) break;

        const taskIndex = queue.shift();
        if (taskIndex === undefined) break;

        // Throttle between tasks (skip delay for first task in slot)
        if (!isFirst && config.taskDelayMs > 0) {
          await delay(config.taskDelayMs);
        }
        isFirst = false;

        const result = await executeTask(taskIndex);
        results[taskIndex] = result;

        // Update aggregates
        if (result.status === 'completed') {
          completed++;
          totalTokensUsed += result.tokensUsed ?? 0;
          consecutiveSlotFailures = 0;
          globalConsecutiveFailures = 0;
        } else {
          failed++;
          consecutiveSlotFailures++;
          globalConsecutiveFailures++;

          // Per-slot cooldown on consecutive failures
          if (consecutiveSlotFailures >= 3) {
            const cooldownMs = Math.min(30_000 * consecutiveSlotFailures, 300_000);
            onProgress?.({
              current: progressCount,
              total: config.count,
              status: 'failed',
              themeId: result.themeId,
              message: `Slot cooldown: ${Math.ceil(cooldownMs / 1000)}s after ${consecutiveSlotFailures} consecutive failures`,
            });
            await delay(cooldownMs);
          }

          // Global emergency stop
          if (maxConsecutiveFailures > 0 && globalConsecutiveFailures >= maxConsecutiveFailures) {
            emergencyStopped = true;
            onProgress?.({
              current: progressCount,
              total: config.count,
              status: 'failed',
              themeId: result.themeId,
              message: `Emergency stop: ${globalConsecutiveFailures} consecutive failures`,
            });
            break;
          }
        }

        progressCount++;
        onProgress?.({
          current: progressCount,
          total: config.count,
          status: result.status === 'completed' ? 'completed' : 'failed',
          themeId: result.themeId,
        });
      }
    };

    // Run N slots in parallel
    const slotCount = Math.min(config.parallel, config.count);
    await Promise.all(Array.from({ length: slotCount }, () => runSlot()));

    return {
      totalTasks: config.count,
      completed,
      failed,
      skipped: 0,
      totalTokensUsed,
      results: results.filter(Boolean),
    };
  };

  return { run };
}

