/**
 * Writer agent configuration
 */
export interface WriterConfig {
  id: string;
  temperature: number;
  topP: number;
  style: 'balanced' | 'creative' | 'conservative' | 'moderate';
}

/**
 * Default writer configurations for tournament
 */
export const DEFAULT_WRITERS: WriterConfig[] = [
  { id: 'writer_1', temperature: 0.7, topP: 0.9, style: 'balanced' },
  { id: 'writer_2', temperature: 0.9, topP: 0.95, style: 'creative' },
  { id: 'writer_3', temperature: 0.5, topP: 0.8, style: 'conservative' },
  { id: 'writer_4', temperature: 0.8, topP: 0.85, style: 'moderate' },
];

/**
 * Score breakdown for judge evaluation
 */
export interface ScoreBreakdown {
  style: number;
  compliance: number;
  overall: number;
}

/**
 * Result of judge evaluation
 */
export interface JudgeResult {
  winner: 'A' | 'B';
  reasoning: string;
  scores: {
    A: ScoreBreakdown;
    B: ScoreBreakdown;
  };
}

/**
 * Generation result from a writer
 */
export interface GenerationResult {
  writerId: string;
  text: string;
  tokensUsed: number;
}

/**
 * Plotter agent configuration
 */
export interface PlotterConfig {
  chapterCount: number;
  targetTotalLength: number;
  temperature?: number;
  /** Optional theme for guided plot generation (used by Factory) */
  theme?: import('../schemas/generated-theme.js').GeneratedTheme;
}

/**
 * Default plotter configuration
 */
export const DEFAULT_PLOTTER_CONFIG: PlotterConfig = {
  chapterCount: 5,
  targetTotalLength: 20000,
  temperature: 0.7,
};

/**
 * Result of plot generation
 */
export interface PlotResult {
  plot: import('../schemas/plot.js').Plot;
  tokensUsed: number;
}

// =====================
// Compliance Types
// =====================

/**
 * Types of violations that can be detected
 */
export type ViolationType =
  | 'forbidden_word'
  | 'sentence_too_long'
  | 'forbidden_simile'
  | 'special_mark_misuse'
  | 'theme_violation';

/**
 * A single violation found in text
 */
export interface Violation {
  type: ViolationType;
  position: { start: number; end: number };
  context: string;
  rule: string;
  severity: 'error' | 'warning';
}

/**
 * Result of compliance check
 */
export interface ComplianceResult {
  isCompliant: boolean;
  score: number;
  violations: Violation[];
}

/**
 * Result of a single correction attempt
 */
export interface CorrectionResult {
  correctedText: string;
  tokensUsed: number;
}

/**
 * Result of the full correction loop
 */
export interface CorrectionLoopResult {
  success: boolean;
  finalText: string;
  attempts: number;
  totalTokensUsed: number;
  originalViolations?: Violation[];
}

// =====================
// Reader Jury Types
// =====================

/**
 * Category scores for reader evaluation
 */
export interface CategoryScores {
  style: number;
  plot: number;
  character: number;
  worldbuilding: number;
  readability: number;
}

/**
 * Evaluation result from a single persona
 */
export interface PersonaEvaluation {
  personaId: string;
  personaName: string;
  categoryScores: CategoryScores;
  weightedScore: number;
  feedback: string;
}

/**
 * Combined result from reader jury
 */
export interface ReaderJuryResult {
  evaluations: PersonaEvaluation[];
  aggregatedScore: number;
  passed: boolean;
  summary: string;
}

// =====================
// Full Pipeline Types
// =====================

/**
 * Configuration for full pipeline execution
 */
export interface FullPipelineConfig {
  chapterCount: number;
  targetTotalLength: number;
  maxCorrectionAttempts: number;
  dbPath: string;
}

/**
 * Default full pipeline configuration
 */
export const DEFAULT_FULL_PIPELINE_CONFIG: FullPipelineConfig = {
  chapterCount: 5,
  targetTotalLength: 20000,
  maxCorrectionAttempts: 3,
  dbPath: 'soul-writer.db',
};

/**
 * Result of a single chapter in the full pipeline
 */
export interface ChapterPipelineResult {
  chapterIndex: number;
  text: string;
  champion: string;
  complianceResult: ComplianceResult;
  correctionAttempts: number;
  readerJuryResult: ReaderJuryResult;
  learningResult?: import('../learning/learning-pipeline.js').ProcessResult;
  tokensUsed: number;
}

/**
 * Result of the full pipeline execution
 */
export interface FullPipelineResult {
  taskId: string;
  plot: import('../schemas/plot.js').Plot;
  chapters: ChapterPipelineResult[];
  totalTokensUsed: number;
  avgComplianceScore: number;
  avgReaderScore: number;
  learningCandidates: number;
  antiPatternsCollected: number;
}
