import { generate } from './cli/generate.js';

const args = process.argv.slice(2);

function printUsage(): void {
  console.log(`
Soul Writer - LLM-based novel generation system

Usage:
  npx tsx src/main.ts generate --soul <path> --prompt <text>

Commands:
  generate    Run tournament generation

Options:
  --soul      Path to soul text directory (default: "soul")
  --prompt    Generation prompt

Examples:
  npx tsx src/main.ts generate --soul soul --prompt "透心の朝の独白を書いてください"
  `);
}

function parseArgs(args: string[]): { command: string; options: Record<string, string> } {
  const command = args[0] || '';
  const options: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] || '';
      if (!value.startsWith('--')) {
        options[key] = value;
        i++;
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

      if (!prompt) {
        console.error('Error: --prompt is required');
        printUsage();
        process.exit(1);
      }

      await generate({ soul, prompt });
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
