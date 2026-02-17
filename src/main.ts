import { generate } from './cli/generate.js';
import { resume } from './cli/resume.js';
import { review } from './cli/review.js';
import { factory } from './cli/factory.js';

const args = process.argv.slice(2);

function printUsage(): void {
  console.log(`
Soul Writer - LLM-based novel generation system

Usage:
  npx tsx src/main.ts <command> [options]

Commands:
  generate    Generate a story (single or multi-chapter, with optional auto-theme)
  resume      Resume an interrupted story generation
  review      Review and approve learning candidates
  factory     Run batch generation with random themes

generate Options:
  --prompt       Generation prompt (required unless --auto-theme)
  --auto-theme   Auto-generate theme and characters (no --prompt needed)
  --chapters     Number of chapters (default: 5)
  --simple       Tournament only, no post-processing, no DB
  --mode         Generation mode: "tournament" (default) or "collaboration"
  --soul         Path to soul text directory (default: "soul")
  --db           Path to SQLite database (default: "soul-writer.db")
  --include-raw-soultext  Include raw soultext.md in writer prompts (default: off)
  --exclude-learned       Exclude learned fragments from generation (default: off)

resume Options:
  --task-id   Task ID to resume (required)

factory Options:
  --config              Path to factory config JSON file (optional)
  --count               Number of stories to generate (default: 10)
  --parallel            Number of parallel executions, 1-8 (default: 4)
  --chapters-per-story  Chapters per story (default: 5)
  --soul                Path to soul text directory (default: "soul")
  --output              Output directory (default: "output")
  --db                  Path to SQLite database (default: "factory.db")
  --task-delay          Delay ms between tasks per worker (default: 1000)
  --mode                Generation mode: "tournament" (default) or "collaboration"
  --include-raw-soultext  Include raw soultext.md in writer prompts (default: off)
  --exclude-learned       Exclude learned fragments from generation (default: off)
  --resume              Resume interrupted batch generation

Examples:
  # Simple tournament generation (no DB)
  npx tsx src/main.ts generate --simple --prompt "透心の朝の独白を書いてください"

  # Full story generation (5 chapters, with DB)
  npx tsx src/main.ts generate --prompt "透心とつるぎの出会い" --chapters 5

  # Auto-theme generation (theme + characters auto-generated)
  npx tsx src/main.ts generate --auto-theme --chapters 3

  # Resume interrupted task
  npx tsx src/main.ts resume --task-id <id> --soul soul

  # Review learning candidates
  npx tsx src/main.ts review --soul soul

  # Batch generation with config file
  npx tsx src/main.ts factory --config factory-config.json

  # Batch generation with CLI arguments
  npx tsx src/main.ts factory --count 5 --parallel 2 --chapters-per-story 3

  # Config file with CLI overrides
  npx tsx src/main.ts factory --config factory-config.json --count 20

Global Options:
  --verbose    Enable detailed logging of each pipeline step
  `);
}

function parseArgs(args: string[]): { command: string; options: Record<string, string> } {
  const command = args[0] || '';
  const options: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        // Boolean flag (no value)
        options[key] = 'true';
      }
    }
  }

  return { command, options };
}

async function main(): Promise<void> {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const { command, options } = parseArgs(args);

  switch (command) {
    case 'generate': {
      const soul = options.soul || 'soul';
      const prompt = options.prompt;
      const autoTheme = options['auto-theme'] === 'true';
      const chapters = options.chapters ? parseInt(options.chapters, 10) : undefined;
      const dbPath = options.db || 'soul-writer.db';
      const simple = options.simple === 'true';
      const verbose = options.verbose === 'true';
      const mode = options.mode as 'tournament' | 'collaboration' | undefined;
      const includeRawSoultext = options['include-raw-soultext'] === 'true';
      const excludeLearned = options['exclude-learned'] === 'true';

      if (!prompt && !autoTheme) {
        console.error('Error: --prompt or --auto-theme is required');
        printUsage();
        process.exit(1);
      }

      await generate({ soul, prompt, autoTheme, chapters, dbPath, simple, verbose, mode, includeRawSoultext, excludeLearned });
      break;
    }

    case 'resume': {
      const soul = options.soul || 'soul';
      const taskId = options['task-id'];
      const dbPath = options.db || 'soul-writer.db';
      const verbose = options.verbose === 'true';

      if (!taskId) {
        console.error('Error: --task-id is required');
        printUsage();
        process.exit(1);
      }

      await resume({ taskId, soul, dbPath, verbose });
      break;
    }

    case 'review': {
      const soul = options.soul || 'soul';
      const dbPath = options.db || 'soul-writer.db';

      await review({ soul, dbPath });
      break;
    }

    case 'factory': {
      const verbose = options.verbose === 'true';
      const includeRawSoultextFactory = options['include-raw-soultext'] === 'true';
      await factory({
        config: options.config,
        resume: options.resume === 'true',
        verbose,
        includeRawSoultext: includeRawSoultextFactory,
        count: options.count ? parseInt(options.count, 10) : undefined,
        parallel: options.parallel ? parseInt(options.parallel, 10) : undefined,
        chaptersPerStory: options['chapters-per-story'] ? parseInt(options['chapters-per-story'], 10) : undefined,
        soulPath: options.soul,
        outputDir: options.output,
        dbPath: options.db,
        taskDelayMs: options['task-delay'] ? parseInt(options['task-delay'], 10) : undefined,
        mode: options.mode,
        excludeLearned: options['exclude-learned'] === 'true',
      });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
