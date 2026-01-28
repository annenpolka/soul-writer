import { describe, it, expect, afterEach } from 'vitest';
import { DatabaseConnection } from '../../src/storage/database.js';

describe('DatabaseConnection', () => {
  let db: DatabaseConnection | null = null;

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
  });

  describe('constructor', () => {
    it('should create an in-memory database by default', () => {
      db = new DatabaseConnection();
      expect(db).toBeInstanceOf(DatabaseConnection);
    });

    it('should create a database with getDb method', () => {
      db = new DatabaseConnection();
      expect(db.getDb()).toBeDefined();
    });
  });

  describe('runMigrations', () => {
    it('should create all required tables', () => {
      db = new DatabaseConnection();
      db.runMigrations();

      // Check that tables exist by trying to query them
      const drizzleDb = db.getDb();

      // This will throw if tables don't exist
      expect(() => {
        drizzleDb.run('SELECT 1 FROM works LIMIT 1');
      }).not.toThrow();

      expect(() => {
        drizzleDb.run('SELECT 1 FROM chapters LIMIT 1');
      }).not.toThrow();

      expect(() => {
        drizzleDb.run('SELECT 1 FROM tasks LIMIT 1');
      }).not.toThrow();

      expect(() => {
        drizzleDb.run('SELECT 1 FROM checkpoints LIMIT 1');
      }).not.toThrow();

      expect(() => {
        drizzleDb.run('SELECT 1 FROM soul_candidates LIMIT 1');
      }).not.toThrow();
    });

    it('should be idempotent', () => {
      db = new DatabaseConnection();

      // Run migrations twice
      expect(() => {
        db!.runMigrations();
        db!.runMigrations();
      }).not.toThrow();
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      db = new DatabaseConnection();
      expect(() => db!.close()).not.toThrow();
      db = null; // Prevent afterEach from trying to close again
    });
  });

  describe('WAL mode', () => {
    it('should enable WAL mode for file-based database', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const tmpDir = os.tmpdir();
      const dbPath = path.join(tmpDir, `test-wal-${Date.now()}.db`);

      try {
        db = new DatabaseConnection(dbPath);

        // WAL mode is set in constructor via pragma
        // We can verify by checking the journal_mode
        const result = db.getSqlite().pragma('journal_mode');
        expect(result).toEqual([{ journal_mode: 'wal' }]);

        db.close();
        db = null;
      } finally {
        // Cleanup test database files
        try {
          fs.unlinkSync(dbPath);
          fs.unlinkSync(dbPath + '-wal');
          fs.unlinkSync(dbPath + '-shm');
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should fall back to memory mode for in-memory database', () => {
      db = new DatabaseConnection();

      // In-memory databases don't support WAL, they use 'memory' mode
      const result = db.getSqlite().pragma('journal_mode');
      expect(result).toEqual([{ journal_mode: 'memory' }]);
    });
  });
});
