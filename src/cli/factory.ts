import * as fs from 'node:fs';
import dotenv from 'dotenv';
import { createLLMClientFromResolvedConfig } from '../llm/provider-factory.js';
import { resolveLLMConfig } from '../llm/config.js';
import { loadSoulTextManager } from '../soul/manager.js';
import { DatabaseConnection } from '../storage/database.js';
import { createTaskRepo } from '../storage/task-repository.js';
import { createWorkRepo } from '../storage/work-repository.js';
import { createCheckpointRepo } from '../storage/checkpoint-repository.js';
import { createCheckpointManager } from '../storage/checkpoint-manager.js';
import { createSoulCandidateRepo } from '../storage/soul-candidate-repository.js';
import { createJudgeSessionRepo } from '../storage/judge-session-repository.js';
import { createChapterEvalRepo } from '../storage/chapter-evaluation-repository.js';
import { createSynthesisPlanRepo } from '../storage/synthesis-plan-repository.js';
import { createCorrectionHistoryRepo } from '../storage/correction-history-repository.js';
import { createCrossChapterStateRepo } from '../storage/cross-chapter-state-repository.js';
import { createPhaseMetricsRepo } from '../storage/phase-metrics-repository.js';
import { FactoryConfigSchema } from '../schemas/factory-config.js';
import { createBatchRunner, type ProgressInfo, calculateAnalytics, generateCliReport, generateJsonReport } from '../factory/index.js';

dotenv.config();

export interface FactoryOptions {
  config?: string;
  resume?: boolean;
  count?: number;
  parallel?: number;
  chaptersPerStory?: number;
  soulPath?: string;
  outputDir?: string;
  dbPath?: string;
  taskDelayMs?: number;
  verbose?: boolean;
  mode?: string;
  includeRawSoultext?: boolean;
  excludeLearned?: boolean;
  provider?: string;
  model?: string;
  reasoningEffort?: string;
}

export async function factory(options: FactoryOptions): Promise<void> {
  // 1. Load and validate config
  let rawConfig: Record<string, unknown> = {};

  // Load from config file if specified
  const configPath = options.config;
  if (configPath) {
    if (!fs.existsSync(configPath)) {
      console.error(`Error: Config file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      console.error(`Error: Invalid JSON in config file: ${configPath}`);
      process.exit(1);
    }
  }

  // Override with CLI arguments
  if (options.count !== undefined) rawConfig.count = options.count;
  if (options.parallel !== undefined) rawConfig.parallel = options.parallel;
  if (options.chaptersPerStory !== undefined) rawConfig.chaptersPerStory = options.chaptersPerStory;
  if (options.soulPath !== undefined) rawConfig.soulPath = options.soulPath;
  if (options.outputDir !== undefined) rawConfig.outputDir = options.outputDir;
  if (options.dbPath !== undefined) rawConfig.dbPath = options.dbPath;
  if (options.taskDelayMs !== undefined) rawConfig.taskDelayMs = options.taskDelayMs;
  if (options.mode !== undefined) rawConfig.mode = options.mode;

  const configResult = FactoryConfigSchema.safeParse(rawConfig);
  if (!configResult.success) {
    console.error(`Error: Invalid config: ${configResult.error.message}`);
    process.exit(1);
  }
  const config = configResult.data;

  console.log(`\n📖 Soul Writer Factory`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Config: ${configPath ?? '(CLI arguments)'}`);
  console.log(`Count: ${config.count}`);
  console.log(`Parallel: ${config.parallel}`);
  console.log(`Chapters per story: ${config.chaptersPerStory}`);
  console.log(`Soul: ${config.soulPath}`);
  console.log(`Output: ${config.outputDir}`);
  console.log(`Database: ${config.dbPath}`);
  console.log(`Mode: ${config.mode}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 2. Load soul text
  console.log(`Loading soul text from "${config.soulPath}"...`);
  const soulManager = await loadSoulTextManager(config.soulPath, {
    includeLearned: !options.excludeLearned,
  });
  if (!options.includeRawSoultext) {
    soulManager.clearRawSoultext();
  }
  console.log(`✓ Loaded: ${soulManager.getConstitution().meta.soul_name}\n`);

  // 3. Initialize database
  console.log(`Initializing database...`);
  const db = new DatabaseConnection(config.dbPath);
  db.runMigrations();
  console.log(`✓ Database ready\n`);

  // 4. Create repositories
  const sqlite = db.getSqlite();
  const taskRepo = createTaskRepo(sqlite);
  const workRepo = createWorkRepo(sqlite);
  const checkpointRepo = createCheckpointRepo(sqlite);
  const checkpointManager = createCheckpointManager(checkpointRepo);
  const candidateRepo = createSoulCandidateRepo(sqlite);

  // 4b. Create analytics repositories
  const judgeSessionRepo = createJudgeSessionRepo(sqlite);
  const chapterEvalRepo = createChapterEvalRepo(sqlite);
  const synthesisPlanRepo = createSynthesisPlanRepo(sqlite);
  const correctionHistoryRepo = createCorrectionHistoryRepo(sqlite);
  const crossChapterStateRepo = createCrossChapterStateRepo(sqlite);
  const phaseMetricsRepo = createPhaseMetricsRepo(sqlite);

  // 5. Create LLM client
  const llmConfig = resolveLLMConfig(process.env, {
    provider: options.provider,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
  });
  const llmClient = await createLLMClientFromResolvedConfig(llmConfig);

  // 6. Create and run batch runner
  const runner = createBatchRunner(config, {
    soulText: soulManager.getSoulText(),
    llmClient,
    taskRepo,
    workRepo,
    checkpointManager,
    candidateRepo,
    judgeSessionRepo,
    chapterEvalRepo,
    synthesisPlanRepo,
    correctionHistoryRepo,
    crossChapterStateRepo,
    phaseMetricsRepo,
  }, { verbose: options.verbose });

  console.log('Starting batch generation...\n');

  // Progress callback
  const onProgress = (info: ProgressInfo) => {
    const percent = ((info.current / info.total) * 100).toFixed(1);
    const bar = createProgressBar(info.current, info.total, 30);
    const status = info.status === 'completed' ? '✓' : '✗';
    process.stdout.write(`\r${bar} ${percent}% [${info.current}/${info.total}] ${status}`);
  };

  try {
    const result = await runner.run(onProgress);

    // Calculate analytics
    const analytics = calculateAnalytics(result);
    // Final output
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✓ Batch completed!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`Results:`);
    console.log(`  Completed: ${result.completed}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Skipped: ${result.skipped}`);

    if (result.failed > 0) {
      console.log(`\nFailed tasks:`);
      for (const task of result.results.filter((r) => r.status === 'failed')) {
        console.log(`  - ${task.themeId}: ${task.error}`);
      }
    }

    // Detailed report
    console.log(generateCliReport(analytics));

    // Save JSON report
    const jsonReport = generateJsonReport(result, analytics);
    const reportPath = `${config.outputDir}/report.json`;
    fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));
    console.log(`\n📄 Report saved: ${reportPath}\n`);

  } catch (error) {
    console.error(`\nError during batch generation:`, (error as Error).message);
    throw error;
  } finally {
    db.close();
  }
}

function createProgressBar(current: number, total: number, width: number): string {
  const progress = current / total;
  const filled = Math.round(progress * width);
  const empty = width - filled;
  return `[${'='.repeat(filled)}${'>'}${' '.repeat(Math.max(0, empty - 1))}]`;
}
