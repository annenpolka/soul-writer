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
  --soul         Path to soul text directory (default: "soul")
  --db           Path to SQLite database (default: "soul-writer.db")

resume Options:
  --task-id   Task ID to resume (required)

factory Options:
  --config    Path to factory config JSON file (required)
  --resume    Resume interrupted batch generation

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

  # Batch generation with random themes
  npx tsx src/main.ts factory --config factory-config.json
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

      if (!prompt && !autoTheme) {
        console.error('Error: --prompt or --auto-theme is required');
        printUsage();
        process.exit(1);
      }

      await generate({ soul, prompt, autoTheme, chapters, dbPath, simple });
      break;
    }

    case 'resume': {
      const soul = options.soul || 'soul';
      const taskId = options['task-id'];
      const dbPath = options.db || 'soul-writer.db';

      if (!taskId) {
        console.error('Error: --task-id is required');
        printUsage();
        process.exit(1);
      }

      await resume({ taskId, soul, dbPath });
      break;
    }

    case 'review': {
      const soul = options.soul || 'soul';
      const dbPath = options.db || 'soul-writer.db';

      await review({ soul, dbPath });
      break;
    }

    case 'factory': {
      const configPath = options.config;
      const resumeFlag = options.resume === 'true';

      if (!configPath) {
        console.error('Error: --config is required');
        printUsage();
        process.exit(1);
      }

      await factory({ config: configPath, resume: resumeFlag });
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
