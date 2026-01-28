import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

/**
 * Works table - stores completed story generations
 */
export const works = sqliteTable(
  'works',
  {
    id: text('id').primaryKey(),
    soulId: text('soul_id').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    totalChapters: integer('total_chapters').notNull(),
    totalTokens: integer('total_tokens').notNull(),
    complianceScore: real('compliance_score'),
    readerScore: real('reader_score'),
    status: text('status').notNull().default('completed'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_works_soul_id').on(table.soulId),
    index('idx_works_status').on(table.status),
  ]
);

/**
 * Chapters table - stores individual chapters
 */
export const chapters = sqliteTable(
  'chapters',
  {
    id: text('id').primaryKey(),
    workId: text('work_id')
      .notNull()
      .references(() => works.id),
    chapterIndex: integer('chapter_index').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    championWriterId: text('champion_writer_id').notNull(),
    tokensUsed: integer('tokens_used').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_chapters_work_id').on(table.workId)]
);

/**
 * Tournament matches table - stores tournament results
 */
export const tournamentMatches = sqliteTable(
  'tournament_matches',
  {
    id: text('id').primaryKey(),
    chapterId: text('chapter_id')
      .notNull()
      .references(() => chapters.id),
    matchName: text('match_name').notNull(),
    contestantA: text('contestant_a').notNull(),
    contestantB: text('contestant_b').notNull(),
    winner: text('winner').notNull(),
    reasoning: text('reasoning').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_matches_chapter_id').on(table.chapterId)]
);

/**
 * Judge scores table - stores detailed scores
 */
export const judgeScores = sqliteTable('judge_scores', {
  id: text('id').primaryKey(),
  matchId: text('match_id')
    .notNull()
    .references(() => tournamentMatches.id),
  contestant: text('contestant').notNull(),
  styleScore: real('style_score').notNull(),
  complianceScore: real('compliance_score').notNull(),
  overallScore: real('overall_score').notNull(),
});

/**
 * Reader evaluations table - stores reader jury evaluations
 */
export const readerEvaluations = sqliteTable(
  'reader_evaluations',
  {
    id: text('id').primaryKey(),
    chapterId: text('chapter_id')
      .notNull()
      .references(() => chapters.id),
    personaId: text('persona_id').notNull(),
    personaName: text('persona_name').notNull(),
    styleScore: real('style_score').notNull(),
    plotScore: real('plot_score').notNull(),
    characterScore: real('character_score').notNull(),
    worldbuildingScore: real('worldbuilding_score').notNull(),
    readabilityScore: real('readability_score').notNull(),
    overallScore: real('overall_score').notNull(),
    feedback: text('feedback'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_reader_evals_chapter_id').on(table.chapterId)]
);

/**
 * Tasks table - task queue for generation
 */
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    soulId: text('soul_id').notNull(),
    status: text('status').notNull().default('pending'),
    params: text('params').notNull(),
    error: text('error'),
    createdAt: text('created_at').notNull(),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('idx_tasks_status').on(table.status),
    index('idx_tasks_soul_id').on(table.soulId),
  ]
);

/**
 * Checkpoints table - for resumable generation
 */
export const checkpoints = sqliteTable(
  'checkpoints',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    phase: text('phase').notNull(),
    progress: text('progress').notNull(),
    state: text('state').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_checkpoints_task_id').on(table.taskId)]
);

/**
 * Soul candidates table - for auto-learning
 */
export const soulCandidates = sqliteTable(
  'soul_candidates',
  {
    id: text('id').primaryKey(),
    soulId: text('soul_id').notNull(),
    sourceWorkId: text('source_work_id')
      .notNull()
      .references(() => works.id),
    sourceChapterId: text('source_chapter_id').references(() => chapters.id),
    fragmentText: text('fragment_text').notNull(),
    suggestedCategory: text('suggested_category').notNull(),
    autoScore: real('auto_score').notNull(),
    status: text('status').notNull().default('pending'),
    reviewerNotes: text('reviewer_notes'),
    createdAt: text('created_at').notNull(),
    reviewedAt: text('reviewed_at'),
  },
  (table) => [
    index('idx_candidates_status').on(table.status),
    index('idx_candidates_soul_id').on(table.soulId),
  ]
);

// Type exports
export type Work = typeof works.$inferSelect;
export type NewWork = typeof works.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Checkpoint = typeof checkpoints.$inferSelect;
export type NewCheckpoint = typeof checkpoints.$inferInsert;
export type SoulCandidate = typeof soulCandidates.$inferSelect;
export type NewSoulCandidate = typeof soulCandidates.$inferInsert;
