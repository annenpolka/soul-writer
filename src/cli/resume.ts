import dotenv from 'dotenv';
import { createLLMClient, type LLMProvider } from '../llm/provider-factory.js';
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
import { createFullPipeline } from '../pipeline/full.js';
import { createLogger } from '../logger.js';

dotenv.config();

export interface ResumeOptions {
  taskId: string;
  soul: string;
  dbPath?: string;
  verbose?: boolean;
}

export async function resume(options: ResumeOptions): Promise<void> {
  const { taskId, soul, dbPath = 'soul-writer.db', verbose = false } = options;

  const logger = createLogger({
    verbose,
    logFile: verbose ? `logs/resume-${Date.now()}.log` : undefined,
  });

  console.log(`\n🔄 Soul Writer - Resume Task`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Task ID: ${taskId}`);
  console.log(`Soul: ${soul}`);
  console.log(`Database: ${dbPath}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Check environment
  const provider = (process.env.LLM_PROVIDER || 'cerebras') as LLMProvider;

  // Load soul text
  console.log(`Loading soul text from "${soul}"...`);
  const soulManager = await loadSoulTextManager(soul);
  console.log(`✓ Loaded: ${soulManager.getConstitution().meta.soul_name}\n`);

  // Initialize database
  console.log(`Initializing database...`);
  const db = new DatabaseConnection(dbPath);
  db.runMigrations();
  console.log(`✓ Database ready\n`);

  // Create repositories
  const sqlite = db.getSqlite();
  const taskRepo = createTaskRepo(sqlite);
  const workRepo = createWorkRepo(sqlite);
  const checkpointRepo = createCheckpointRepo(sqlite);
  const checkpointManager = createCheckpointManager(checkpointRepo);
  const candidateRepo = createSoulCandidateRepo(sqlite);

  // Check if task can be resumed
  console.log(`Checking checkpoint for task ${taskId}...`);
  const canResume = await checkpointManager.canResume(taskId);
  if (!canResume) {
    console.error(`Error: No checkpoint found for task ${taskId}`);
    console.error(`The task may have completed or never started.`);
    process.exit(1);
  }

  const resumeState = await checkpointManager.getResumeState(taskId);
  if (resumeState) {
    const progress = resumeState._progress as { completedChapters: number; totalChapters: number };
    console.log(`✓ Checkpoint found: ${progress.completedChapters}/${progress.totalChapters} chapters completed\n`);
  }

  // Create LLM client
  const llmClient = await createLLMClient({
    provider,
    cerebrasApiKey: process.env.CEREBRAS_API_KEY,
    cerebrasModel: process.env.CEREBRAS_MODEL || 'zai-glm-4.7',
    codexModel: process.env.CODEX_MODEL || 'gpt-5.2',
  });

  // Create analytics repositories
  const judgeSessionRepo = createJudgeSessionRepo(sqlite);
  const chapterEvalRepo = createChapterEvalRepo(sqlite);
  const synthesisPlanRepo = createSynthesisPlanRepo(sqlite);
  const correctionHistoryRepo = createCorrectionHistoryRepo(sqlite);
  const crossChapterStateRepo = createCrossChapterStateRepo(sqlite);
  const phaseMetricsRepo = createPhaseMetricsRepo(sqlite);

  // Create pipeline
  const pipeline = createFullPipeline({
    llmClient,
    soulManager,
    checkpointManager,
    taskRepo,
    workRepo,
    candidateRepo,
    config: {},
    logger,
    judgeSessionRepo,
    chapterEvalRepo,
    synthesisPlanRepo,
    correctionHistoryRepo,
    crossChapterStateRepo,
    phaseMetricsRepo,
  });

  console.log('Resuming story generation...\n');

  try {
    const result = await pipeline.resume(taskId);

    // Output results
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✓ Story completed!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`Task ID: ${result.taskId}`);
    console.log(`Title: ${result.plot.title}`);
    console.log(`Theme: ${result.plot.theme}`);
    console.log(`Chapters: ${result.chapters.length}`);
    console.log(`\nPer-chapter results:`);

    for (const chapter of result.chapters) {
      const complianceStatus = chapter.complianceResult.isCompliant ? 'PASS' : 'FAIL';
      const verdict = chapter.evaluationResult.verdictLevel;
      const majorCount = chapter.evaluationResult.majorCount;
      console.log(
        `  Chapter ${chapter.chapterIndex}: Compliance ${complianceStatus}, Quality: ${verdict}${majorCount > 0 ? ` (${majorCount} major)` : ''}`
      );
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Statistics:`);
    console.log(`  Total tokens: ${result.totalTokensUsed}`);
    console.log(`  Compliance pass rate: ${(result.compliancePassRate * 100).toFixed(1)}%`);
    if (result.verdictDistribution) {
      const dist = Object.entries(result.verdictDistribution).map(([k, v]) => `${k}: ${v}`).join(', ');
      console.log(`  Verdict distribution: ${dist}`);
    }
    console.log(`  Learning candidates: ${result.learningCandidates}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Output the story
    console.log('Generated Story:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`# ${result.plot.title}\n`);

    for (const chapter of result.chapters) {
      const plotChapter = result.plot.chapters[chapter.chapterIndex - 1];
      console.log(`\n## ${plotChapter.title}\n`);
      console.log(chapter.text);
      console.log('\n---');
    }
  } catch (error) {
    console.error(`\nError during generation:`, (error as Error).message);
    console.error(`\nYou can retry with: npx tsx src/main.ts resume --task-id ${taskId} --soul ${soul}`);
    throw error;
  } finally {
    logger.close();
    db.close();
  }
}
