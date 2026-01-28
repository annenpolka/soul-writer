import dotenv from 'dotenv';
import { CerebrasClient } from '../llm/cerebras.js';
import { SoulTextManager } from '../soul/manager.js';
import { DatabaseConnection } from '../storage/database.js';
import { TaskRepository } from '../storage/task-repository.js';
import { WorkRepository } from '../storage/work-repository.js';
import { CheckpointRepository } from '../storage/checkpoint-repository.js';
import { CheckpointManager } from '../storage/checkpoint-manager.js';
import { SoulCandidateRepository } from '../storage/soul-candidate-repository.js';
import { FullPipeline } from '../pipeline/full.js';

dotenv.config();

export interface ResumeOptions {
  taskId: string;
  soul: string;
  dbPath?: string;
}

export async function resume(options: ResumeOptions): Promise<void> {
  const { taskId, soul, dbPath = 'soul-writer.db' } = options;

  console.log(`\n🔄 Soul Writer - Resume Task`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Task ID: ${taskId}`);
  console.log(`Soul: ${soul}`);
  console.log(`Database: ${dbPath}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Check environment
  const apiKey = process.env.CEREBRAS_API_KEY;
  const model = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';

  if (!apiKey) {
    console.error('Error: CEREBRAS_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Load soul text
  console.log(`Loading soul text from "${soul}"...`);
  const soulManager = await SoulTextManager.load(soul);
  console.log(`✓ Loaded: ${soulManager.getConstitution().meta.soul_name}\n`);

  // Initialize database
  console.log(`Initializing database...`);
  const db = new DatabaseConnection(dbPath);
  db.runMigrations();
  console.log(`✓ Database ready\n`);

  // Create repositories
  const taskRepo = new TaskRepository(db);
  const workRepo = new WorkRepository(db);
  const checkpointRepo = new CheckpointRepository(db);
  const checkpointManager = new CheckpointManager(checkpointRepo);
  const candidateRepo = new SoulCandidateRepository(db);

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
  const llmClient = new CerebrasClient({ apiKey, model });

  // Create pipeline
  const pipeline = new FullPipeline(
    llmClient,
    soulManager,
    checkpointManager,
    taskRepo,
    workRepo,
    candidateRepo
  );

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
      const compliancePercent = (chapter.complianceResult.score * 100).toFixed(1);
      const readerPercent = (chapter.readerJuryResult.aggregatedScore * 100).toFixed(1);
      console.log(
        `  Chapter ${chapter.chapterIndex}: Compliance ${compliancePercent}%, Reader ${readerPercent}%`
      );
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Statistics:`);
    console.log(`  Total tokens: ${result.totalTokensUsed}`);
    console.log(`  Avg compliance: ${(result.avgComplianceScore * 100).toFixed(1)}%`);
    console.log(`  Avg reader score: ${(result.avgReaderScore * 100).toFixed(1)}%`);
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
    db.close();
  }
}
