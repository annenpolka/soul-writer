import dotenv from 'dotenv';
import { CerebrasClient } from '../llm/cerebras.js';
import { SoulTextManager } from '../soul/manager.js';
import { SimplePipeline } from '../pipeline/simple.js';
import { FullPipeline } from '../pipeline/full.js';
import { Logger } from '../logger.js';
import { DatabaseConnection } from '../storage/database.js';
import { TaskRepository } from '../storage/task-repository.js';
import { WorkRepository } from '../storage/work-repository.js';
import { CheckpointRepository } from '../storage/checkpoint-repository.js';
import { CheckpointManager } from '../storage/checkpoint-manager.js';
import { SoulCandidateRepository } from '../storage/soul-candidate-repository.js';
import { ThemeGeneratorAgent } from '../factory/theme-generator.js';
import { CharacterDeveloperAgent } from '../factory/character-developer.js';

dotenv.config();

export interface GenerateOptions {
  soul: string;
  prompt?: string;
  autoTheme?: boolean;
  chapters?: number;
  dbPath?: string;
  simple?: boolean;
  verbose?: boolean;
}

export async function generate(options: GenerateOptions): Promise<void> {
  const {
    soul,
    prompt,
    autoTheme = false,
    chapters,
    dbPath = 'soul-writer.db',
    simple = false,
    verbose = false,
  } = options;

  const logger = new Logger({
    verbose,
    logFile: verbose ? `logs/generate-${Date.now()}.log` : undefined,
  });

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

  // Create LLM client
  const llmClient = new CerebrasClient({ apiKey, model });

  // Simple mode: tournament only, no DB
  if (simple) {
    try {
      return await runSimpleMode(llmClient, soulManager, prompt!, logger);
    } finally {
      logger.close();
    }
  }

  // Full mode: FullPipeline with DB
  try {
    return await runFullMode(llmClient, soulManager, {
      prompt,
      autoTheme,
      chapters,
      dbPath,
    }, logger);
  } finally {
    logger.close();
  }
}

async function runSimpleMode(
  llmClient: CerebrasClient,
  soulManager: SoulTextManager,
  prompt: string,
  logger: Logger,
): Promise<void> {
  console.log(`Mode: Simple (tournament only)\n`);

  const pipeline = new SimplePipeline(llmClient, soulManager, { simple: true, logger });
  const result = await pipeline.generate(prompt);

  console.log(`\n🏆 Champion: ${result.champion}`);
  for (const round of result.tournamentResult.rounds) {
    const winner = round.winner;
    const loser = round.contestantA === winner ? round.contestantB : round.contestantA;
    console.log(`  ${round.matchName}: ${winner} defeated ${loser}`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(result.text);
  console.log(`\nTokens used: ${result.tokensUsed}`);
}

interface FullModeOptions {
  prompt?: string;
  autoTheme: boolean;
  chapters?: number;
  dbPath: string;
}

async function runFullMode(
  llmClient: CerebrasClient,
  soulManager: SoulTextManager,
  opts: FullModeOptions,
  logger: Logger,
): Promise<void> {
  const chapterCount = opts.chapters ?? 5;

  // Initialize DB
  console.log(`Initializing database...`);
  const db = new DatabaseConnection(opts.dbPath);
  db.runMigrations();
  console.log(`✓ Database ready\n`);

  const taskRepo = new TaskRepository(db);
  const workRepo = new WorkRepository(db);
  const checkpointRepo = new CheckpointRepository(db);
  const checkpointManager = new CheckpointManager(checkpointRepo);
  const candidateRepo = new SoulCandidateRepository(db);

  try {
    let storyPrompt: string;
    let developedCharacters: import('../factory/character-developer.js').DevelopedCharacter[] | undefined;
    let narrativeType: string | undefined;

    if (opts.autoTheme) {
      // Auto-theme mode: generate theme → develop characters
      console.log(`Mode: Auto-theme generation\n`);

      const themeGenerator = new ThemeGeneratorAgent(llmClient, soulManager.getSoulText());
      console.log('Generating theme...');
      const themeResult = await themeGenerator.generateTheme();
      console.log(`✓ Theme: ${themeResult.theme.emotion} / ${themeResult.theme.timeline}`);
      console.log(`  Premise: ${themeResult.theme.premise}\n`);

      const charDeveloper = new CharacterDeveloperAgent(llmClient, soulManager.getSoulText());
      console.log('Developing characters...');
      const charResult = await charDeveloper.develop(themeResult.theme);
      developedCharacters = charResult.developed.characters;
      narrativeType = themeResult.theme.narrative_type;
      console.log(`✓ Characters: ${developedCharacters.map(c => c.name).join(', ')}\n`);

      storyPrompt = themeResult.theme.premise;
    } else {
      console.log(`Mode: Prompt-based generation (${chapterCount} chapters)\n`);
      storyPrompt = opts.prompt!;
    }

    // Create FullPipeline
    const pipeline = new FullPipeline(
      llmClient,
      soulManager,
      checkpointManager,
      taskRepo,
      workRepo,
      candidateRepo,
      {
        chapterCount,
        narrativeType,
        developedCharacters,
      },
      logger,
    );

    console.log('Starting story generation...');
    console.log(`Task will be checkpointed after each chapter.\n`);

    const result = await pipeline.generateStory(storyPrompt);

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
        `  Chapter ${chapter.chapterIndex}: Compliance ${compliancePercent}%, Reader ${readerPercent}%`,
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
    console.error(`\nYou can resume this task with: npx tsx src/main.ts resume --task-id <id>`);
    throw error;
  } finally {
    db.close();
  }
}
