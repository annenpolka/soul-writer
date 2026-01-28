import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

/**
 * Database connection manager for SQLite
 */
export class DatabaseConnection {
  private sqlite: Database.Database;
  private db: BetterSQLite3Database<typeof schema>;

  constructor(path: string = ':memory:') {
    this.sqlite = new Database(path);
    this.sqlite.pragma('journal_mode = WAL');
    this.db = drizzle(this.sqlite, { schema });
  }

  /**
   * Get the Drizzle database instance
   */
  getDb(): BetterSQLite3Database<typeof schema> {
    return this.db;
  }

  /**
   * Get the underlying better-sqlite3 instance (for testing/advanced use)
   */
  getSqlite(): Database.Database {
    return this.sqlite;
  }

  /**
   * Run database migrations to create tables
   */
  runMigrations(): void {
    // Create works table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS works (
        id TEXT PRIMARY KEY,
        soul_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        total_chapters INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        compliance_score REAL,
        reader_score REAL,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create chapters table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL REFERENCES works(id),
        chapter_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        champion_writer_id TEXT NOT NULL,
        tokens_used INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Create tournament_matches table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tournament_matches (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL REFERENCES chapters(id),
        match_name TEXT NOT NULL,
        contestant_a TEXT NOT NULL,
        contestant_b TEXT NOT NULL,
        winner TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Create judge_scores table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS judge_scores (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL REFERENCES tournament_matches(id),
        contestant TEXT NOT NULL,
        style_score REAL NOT NULL,
        compliance_score REAL NOT NULL,
        overall_score REAL NOT NULL
      )
    `);

    // Create reader_evaluations table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS reader_evaluations (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL REFERENCES chapters(id),
        persona_id TEXT NOT NULL,
        persona_name TEXT NOT NULL,
        style_score REAL NOT NULL,
        plot_score REAL NOT NULL,
        character_score REAL NOT NULL,
        worldbuilding_score REAL NOT NULL,
        readability_score REAL NOT NULL,
        overall_score REAL NOT NULL,
        feedback TEXT,
        created_at TEXT NOT NULL
      )
    `);

    // Create tasks table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        soul_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        params TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
      )
    `);

    // Create checkpoints table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        phase TEXT NOT NULL,
        progress TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Create soul_candidates table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS soul_candidates (
        id TEXT PRIMARY KEY,
        soul_id TEXT NOT NULL,
        source_work_id TEXT NOT NULL REFERENCES works(id),
        source_chapter_id TEXT REFERENCES chapters(id),
        fragment_text TEXT NOT NULL,
        suggested_category TEXT NOT NULL,
        auto_score REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewer_notes TEXT,
        created_at TEXT NOT NULL,
        reviewed_at TEXT
      )
    `);

    // Create indexes
    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_works_soul_id ON works(soul_id);
      CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);
      CREATE INDEX IF NOT EXISTS idx_chapters_work_id ON chapters(work_id);
      CREATE INDEX IF NOT EXISTS idx_matches_chapter_id ON tournament_matches(chapter_id);
      CREATE INDEX IF NOT EXISTS idx_reader_evals_chapter_id ON reader_evaluations(chapter_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_soul_id ON tasks(soul_id);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_task_id ON checkpoints(task_id);
      CREATE INDEX IF NOT EXISTS idx_candidates_status ON soul_candidates(status);
      CREATE INDEX IF NOT EXISTS idx_candidates_soul_id ON soul_candidates(soul_id);
    `);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.sqlite.close();
  }
}
