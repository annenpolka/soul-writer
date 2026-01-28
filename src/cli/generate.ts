import dotenv from 'dotenv';
import { CerebrasClient } from '../llm/cerebras.js';
import { SoulTextManager } from '../soul/manager.js';
import { SimplePipeline } from '../pipeline/simple.js';

dotenv.config();

interface GenerateOptions {
  soul: string;
  prompt: string;
}

export async function generate(options: GenerateOptions): Promise<void> {
  const { soul, prompt } = options;

  console.log(`\n🎭 Soul Writer - Tournament Generation`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Soul: ${soul}`);
  console.log(`Prompt: ${prompt}`);
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

  // Create LLM client
  const llmClient = new CerebrasClient({ apiKey, model });

  // Create pipeline and generate
  const pipeline = new SimplePipeline(llmClient, soulManager);

  console.log('Running tournament...\n');
  const result = await pipeline.generate(prompt);

  // Output results
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🏆 Champion: ${result.champion}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log('Tournament Rounds:');
  for (const round of result.tournamentResult.rounds) {
    const winner = round.winner;
    const loser = round.contestantA === winner ? round.contestantB : round.contestantA;
    console.log(`  ${round.matchName}: ${winner} defeated ${loser}`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('Generated Text:');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(result.text);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Tokens used: ${result.tokensUsed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}
