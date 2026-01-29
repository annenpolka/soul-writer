import * as fs from 'node:fs';
import dotenv from 'dotenv';
import { CerebrasClient } from '../llm/cerebras.js';
import { SoulTextManager } from '../soul/manager.js';
import { DatabaseConnection } from '../storage/database.js';
import { TaskRepository } from '../storage/task-repository.js';
import { WorkRepository } from '../storage/work-repository.js';
import { CheckpointRepository } from '../storage/checkpoint-repository.js';
import { CheckpointManager } from '../storage/checkpoint-manager.js';
import { SoulCandidateRepository } from '../storage/soul-candidate-repository.js';
import { FactoryConfigSchema } from '../schemas/factory-config.js';
import { BatchRunner, type ProgressInfo, calculateAnalytics, ReportGenerator } from '../factory/index.js';

dotenv.config();

export interface FactoryOptions {
  config: string;
  resume?: boolean;
}

export async function factory(options: FactoryOptions): Promise<void> {
  // 1. Load and validate config
  const configPath = options.config;
  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }

  let rawConfig: unknown;
  try {
    rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    console.error(`Error: Invalid JSON in config file: ${configPath}`);
    process.exit(1);
  }

  const configResult = FactoryConfigSchema.safeParse(rawConfig);
  if (!configResult.success) {
    console.error(`Error: Invalid config: ${configResult.error.message}`);
    process.exit(1);
  }
  const config = configResult.data;

  console.log(`\n📖 Soul Writer Factory`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Config: ${configPath}`);
  console.log(`Count: ${config.count}`);
  console.log(`Parallel: ${config.parallel}`);
  console.log(`Chapters per story: ${config.chaptersPerStory}`);
  console.log(`Soul: ${config.soulPath}`);
  console.log(`Output: ${config.outputDir}`);
  console.log(`Database: ${config.dbPath}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 2. Check environment
  const apiKey = process.env.CEREBRAS_API_KEY;
  const model = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';

  if (!apiKey) {
    console.error('Error: CEREBRAS_API_KEY environment variable is not set');
    process.exit(1);
  }

  // 3. Load soul text
  console.log(`Loading soul text from "${config.soulPath}"...`);
  const soulManager = await SoulTextManager.load(config.soulPath);
  console.log(`✓ Loaded: ${soulManager.getConstitution().meta.soul_name}\n`);

  // 4. Initialize database
  console.log(`Initializing database...`);
  const db = new DatabaseConnection(config.dbPath);
  db.runMigrations();
  console.log(`✓ Database ready\n`);

  // 5. Create repositories
  const taskRepo = new TaskRepository(db);
  const workRepo = new WorkRepository(db);
  const checkpointRepo = new CheckpointRepository(db);
  const checkpointManager = new CheckpointManager(checkpointRepo);
  const candidateRepo = new SoulCandidateRepository(db);

  // 6. Create LLM client
  const llmClient = new CerebrasClient({ apiKey, model });

  // 7. Create and run batch runner
  const runner = new BatchRunner(config, {
    soulText: soulManager.getSoulText(),
    llmClient,
    taskRepo,
    workRepo,
    checkpointManager,
    candidateRepo,
  });

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
    const reporter = new ReportGenerator();

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
    console.log(reporter.generateCliReport(analytics));

    // Save JSON report
    const jsonReport = reporter.generateJsonReport(result, analytics);
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
