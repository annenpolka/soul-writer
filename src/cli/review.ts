import dotenv from 'dotenv';
import { loadSoulTextManager } from '../soul/manager.js';
import { DatabaseConnection } from '../storage/database.js';
import { createSoulCandidateRepo } from '../storage/soul-candidate-repository.js';
import { createSoulExpander } from '../learning/soul-expander.js';
import { createFragmentIntegrator } from '../learning/fragment-integrator.js';
import * as readline from 'readline';

dotenv.config();

export interface ReviewOptions {
  soul: string;
  dbPath?: string;
}

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

export async function review(options: ReviewOptions): Promise<void> {
  const { soul, dbPath = 'soul-writer.db' } = options;

  console.log(`\n📋 Soul Writer - Review Learning Candidates`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Soul: ${soul}`);
  console.log(`Database: ${dbPath}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Load soul text
  console.log(`Loading soul text from "${soul}"...`);
  const soulManager = await loadSoulTextManager(soul);
  const soulId = soulManager.getConstitution().meta.soul_id;
  console.log(`✓ Loaded: ${soulManager.getConstitution().meta.soul_name}\n`);

  // Initialize database
  console.log(`Initializing database...`);
  const db = new DatabaseConnection(dbPath);
  db.runMigrations();
  console.log(`✓ Database ready\n`);

  // Create repository, expander, and integrator
  const candidateRepo = createSoulCandidateRepo(db.getSqlite());
  const expander = createSoulExpander(candidateRepo);
  const integrator = createFragmentIntegrator();

  // Get counts
  const counts = await expander.getCountsByStatus(soulId);
  console.log(`Candidate Status for "${soulId}":`);
  console.log(`  Pending: ${counts.pending}`);
  console.log(`  Approved: ${counts.approved}`);
  console.log(`  Rejected: ${counts.rejected}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (counts.pending === 0) {
    console.log('No pending candidates to review.');
    db.close();
    return;
  }

  // Get pending candidates
  const candidates = await expander.getPendingCandidates(soulId);
  console.log(`Found ${candidates.length} pending candidates.\n`);

  const rl = createReadlineInterface();

  console.log('Review each candidate: (a)pprove, (r)eject, (s)kip, (q)uit\n');

  let reviewed = 0;
  let approved = 0;
  let rejected = 0;

  for (const candidate of candidates) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Candidate ${reviewed + 1}/${candidates.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Category: ${candidate.suggestedCategory}`);
    console.log(`Auto Score: ${(candidate.autoScore * 100).toFixed(1)}%`);
    console.log(`Source: work ${candidate.sourceWorkId.slice(0, 8)}...`);
    if (candidate.sourceChapterId) {
      console.log(`Chapter: ${candidate.sourceChapterId}`);
    }
    console.log(`\nFragment:`);
    console.log(`"${candidate.fragmentText}"`);
    console.log();

    const answer = await askQuestion(rl, '(a)pprove / (r)eject / (s)kip / (q)uit: ');

    switch (answer) {
      case 'a':
      case 'approve': {
        const notes = await askQuestion(rl, 'Notes (optional, press Enter to skip): ');
        await expander.approveCandidate(candidate.id, notes || undefined);
        const intResult = await integrator.integrateOne(candidate, soul);
        if (intResult.success) {
          console.log(`✓ Approved → ${intResult.category}/${intResult.fragmentId} に統合\n`);
        } else {
          console.log(`✓ Approved (統合スキップ: ${intResult.error})\n`);
        }
        approved++;
        reviewed++;
        break;
      }
      case 'r':
      case 'reject': {
        const notes = await askQuestion(rl, 'Reason (optional, press Enter to skip): ');
        await expander.rejectCandidate(candidate.id, notes || undefined);
        console.log('✗ Rejected\n');
        rejected++;
        reviewed++;
        break;
      }
      case 's':
      case 'skip':
        console.log('→ Skipped\n');
        break;
      case 'q':
      case 'quit':
        console.log('\nQuitting review.\n');
        rl.close();
        db.close();
        printSummary(reviewed, approved, rejected);
        return;
      default:
        console.log('Unknown option, skipping.\n');
    }
  }

  rl.close();
  db.close();
  printSummary(reviewed, approved, rejected);
}

function printSummary(reviewed: number, approved: number, rejected: number): void {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Review Summary`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Reviewed: ${reviewed}`);
  console.log(`  Approved: ${approved}`);
  console.log(`  Rejected: ${rejected}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}
