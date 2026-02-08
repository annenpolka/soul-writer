import dotenv from 'dotenv';
import { CerebrasClient } from '../llm/cerebras.js';
import { loadSoulTextManager, type SoulTextManagerFn } from '../soul/manager.js';
import { generateSimple } from '../pipeline/simple.js';
import { createFullPipeline } from '../pipeline/full.js';
import { createLogger, type LoggerFn } from '../logger.js';
import { DatabaseConnection } from '../storage/database.js';
import { createTaskRepo } from '../storage/task-repository.js';
import { createWorkRepo } from '../storage/work-repository.js';
import { createCheckpointRepo } from '../storage/checkpoint-repository.js';
import { createCheckpointManager } from '../storage/checkpoint-manager.js';
import { createSoulCandidateRepo } from '../storage/soul-candidate-repository.js';
import { createThemeGenerator } from '../factory/theme-generator.js';
import { createCharacterDeveloper } from '../factory/character-developer.js';
import { createCharacterMacGuffinAgent } from '../factory/character-macguffin.js';
import { createPlotMacGuffinAgent } from '../factory/plot-macguffin.js';
import { createMotifAnalyzer } from '../factory/motif-analyzer.js';

dotenv.config();

export interface GenerateOptions {
  soul: string;
  prompt?: string;
  autoTheme?: boolean;
  chapters?: number;
  dbPath?: string;
  simple?: boolean;
  verbose?: boolean;
  mode?: 'tournament' | 'collaboration';
  includeRawSoultext?: boolean;
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
    mode,
    includeRawSoultext = false,
  } = options;

  const logger = createLogger({
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
  const soulManager = await loadSoulTextManager(soul);
  if (!includeRawSoultext) {
    soulManager.clearRawSoultext();
  }
  console.log(`✓ Loaded: ${soulManager.getConstitution().meta.soul_name}\n`);

  // Create LLM client
  const llmClient = new CerebrasClient({ apiKey, model });

  // Simple mode: tournament only, no DB
  if (simple) {
    try {
      return await runSimpleMode(llmClient, soulManager, prompt!, logger, mode);
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
      mode,
    }, logger);
  } finally {
    logger.close();
  }
}

async function runSimpleMode(
  llmClient: CerebrasClient,
  soulManager: SoulTextManagerFn,
  prompt: string,
  logger: LoggerFn,
  mode?: 'tournament' | 'collaboration',
): Promise<void> {
  console.log(`Mode: Simple (tournament only)\n`);

  const result = await generateSimple(llmClient, soulManager, prompt, { simple: true, mode, logger });

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
  mode?: 'tournament' | 'collaboration';
}

async function runFullMode(
  llmClient: CerebrasClient,
  soulManager: SoulTextManagerFn,
  opts: FullModeOptions,
  logger: LoggerFn,
): Promise<void> {
  const chapterCount = opts.chapters ?? 5;

  // Initialize DB
  console.log(`Initializing database...`);
  const db = new DatabaseConnection(opts.dbPath);
  db.runMigrations();
  console.log(`✓ Database ready\n`);

  const sqlite = db.getSqlite();
  const taskRepo = createTaskRepo(sqlite);
  const workRepo = createWorkRepo(sqlite);
  const checkpointRepo = createCheckpointRepo(sqlite);
  const checkpointManager = createCheckpointManager(checkpointRepo);
  const candidateRepo = createSoulCandidateRepo(sqlite);

  try {
    let storyPrompt: string;
    let developedCharacters: import('../factory/character-developer.js').DevelopedCharacter[] | undefined;
    let narrativeType: string | undefined;
    let generatedTheme: import('../schemas/generated-theme.js').GeneratedTheme | undefined;
    let characterMacGuffins: import('../schemas/macguffin.js').CharacterMacGuffin[] | undefined;
    let plotMacGuffins: import('../schemas/macguffin.js').PlotMacGuffin[] | undefined;
    let dbMotifAvoidance: string[] = [];

    if (opts.autoTheme) {
      // Auto-theme mode: generate theme → MacGuffins → develop characters → plot MacGuffins
      console.log(`Mode: Auto-theme generation\n`);

      const themeGenerator = createThemeGenerator(llmClient, soulManager.getSoulText());

      // Motif avoidance: analyze recent works from DB
      const soulId = soulManager.getConstitution().meta.soul_id;
      const recentWorks = await workRepo.findRecentBySoulId(soulId, 20);
      if (recentWorks.length > 0) {
        console.log(`Analyzing ${recentWorks.length} recent works for motif avoidance...`);
        const analyzer = createMotifAnalyzer(llmClient);
        const analysis = await analyzer.analyze(recentWorks);
        dbMotifAvoidance = analysis.frequentMotifs;
        console.log(`✓ Found ${dbMotifAvoidance.length} motifs to avoid\n`);
      }

      console.log('Generating theme...');
      const themeResult = await themeGenerator.generateTheme([], dbMotifAvoidance);
      console.log(`✓ Theme: ${themeResult.theme.emotion} / ${themeResult.theme.timeline}`);
      console.log(`  Premise: ${themeResult.theme.premise}\n`);

      // Generate character MacGuffins
      console.log('Generating character mysteries...');
      const charMacGuffinAgent = createCharacterMacGuffinAgent(llmClient, soulManager.getSoulText());
      const charMacGuffinResult = await charMacGuffinAgent.generate(themeResult.theme);
      characterMacGuffins = charMacGuffinResult.macguffins;
      console.log(`✓ Character mysteries: ${characterMacGuffins.map(m => m.characterName).join(', ')}\n`);

      const charDeveloper = createCharacterDeveloper(llmClient, soulManager.getSoulText());
      console.log('Developing characters...');
      const charResult = await charDeveloper.develop(themeResult.theme, characterMacGuffins);
      developedCharacters = charResult.developed.characters;
      narrativeType = themeResult.theme.narrative_type;
      generatedTheme = themeResult.theme;
      console.log(`✓ Characters: ${developedCharacters.map(c => c.name).join(', ')}\n`);

      // Generate plot MacGuffins
      console.log('Generating plot mysteries...');
      const plotMacGuffinAgent = createPlotMacGuffinAgent(llmClient, soulManager.getSoulText());
      const plotMacGuffinResult = await plotMacGuffinAgent.generate(themeResult.theme, characterMacGuffins);
      plotMacGuffins = plotMacGuffinResult.macguffins;
      console.log(`✓ Plot mysteries: ${plotMacGuffins.map(m => m.name).join(', ')}\n`);

      storyPrompt = themeResult.theme.premise;
    } else {
      console.log(`Mode: Prompt-based generation (${chapterCount} chapters)\n`);
      storyPrompt = opts.prompt!;
    }

    // Create FullPipeline
    const pipeline = createFullPipeline({
      llmClient,
      soulManager,
      checkpointManager,
      taskRepo,
      workRepo,
      candidateRepo,
      config: {
        chapterCount,
        narrativeType,
        developedCharacters,
        theme: generatedTheme,
        characterMacGuffins,
        plotMacGuffins,
        motifAvoidanceList: dbMotifAvoidance.length > 0 ? dbMotifAvoidance : undefined,
        mode: opts.mode,
      },
      logger,
    });

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
