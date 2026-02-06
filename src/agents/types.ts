/**
 * Writer agent configuration
 */
export interface WriterConfig {
  id: string;
  temperature: number;
  topP: number;
  style: 'balanced' | 'creative' | 'conservative' | 'moderate';
  /** Focus categories for fragment selection - each writer gets different emphasis */
  focusCategories?: string[];
  /** Persona directive injected into system prompt */
  personaDirective?: string;
  /** Persona display name for logging */
  personaName?: string;
}

/**
 * Default writer configurations for tournament
 */
export const DEFAULT_WRITERS: WriterConfig[] = [
  { id: 'writer_1', temperature: 0.7, topP: 0.9, style: 'balanced', focusCategories: ['opening', 'introspection'] },
  { id: 'writer_2', temperature: 0.9, topP: 0.95, style: 'creative', focusCategories: ['dialogue', 'character_voice'] },
  { id: 'writer_3', temperature: 0.5, topP: 0.8, style: 'conservative', focusCategories: ['killing', 'symbolism'] },
  { id: 'writer_4', temperature: 0.8, topP: 0.85, style: 'moderate', focusCategories: ['world_building', 'introspection'] },
];

/**
 * Score breakdown for judge evaluation
 */
export interface ScoreBreakdown {
  style: number;
  compliance: number;
  overall: number;
  /** Accuracy of character voice reproduction */
  voice_accuracy?: number;
  /** Fidelity to original work's setting and plot */
  originality_fidelity?: number;
  /** Narrative quality: immersion, emotional weight, structural strength */
  narrative_quality?: number;
  /** Novelty: unexpected developments, fresh expressions, new character facets */
  novelty?: number;
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
  /** Praised excerpts from each text (for synthesis) */
  praised_excerpts?: {
    A: string[];
    B: string[];
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
  /** Developed characters from CharacterDeveloper - overrides world-bible characters in prompt */
  developedCharacters?: import('../factory/character-developer.js').DevelopedCharacter[];
  /** MacGuffins for plot mystery injection */
  plotMacGuffins?: import('../schemas/macguffin.js').PlotMacGuffin[];
  characterMacGuffins?: import('../schemas/macguffin.js').CharacterMacGuffin[];
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
  | 'theme_violation'
  | 'pov_violation'
  | 'markdown_contamination'
  | 'quote_direct_copy'
  | 'self_repetition'
  | 'chapter_variation';

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
 * Structured feedback from a reader persona
 */
export interface PersonaFeedback {
  strengths: string;
  weaknesses: string;
  suggestion: string;
}

/**
 * Evaluation result from a single persona
 */
export interface PersonaEvaluation {
  personaId: string;
  personaName: string;
  categoryScores: CategoryScores;
  weightedScore: number;
  feedback: PersonaFeedback;
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
// Theme Context Types
// =====================

/**
 * Theme context for consistent propagation of emotion/tone across agents
 */
export interface ThemeContext {
  /** Emotional theme (e.g., "孤独", "渇望") */
  emotion: string;
  /** Timeline position (e.g., "出会い前", "出会い後") */
  timeline: string;
  /** Story premise */
  premise: string;
  /** Tone directive for writing style */
  tone?: string;
  /** Narrative type */
  narrative_type?: string;
  /** Scene types */
  scene_types?: string[];
}

// =====================
// MacGuffin Context Types
// =====================

/**
 * MacGuffin context for consistent propagation of character secrets and plot mysteries to Writers
 */
export interface MacGuffinContext {
  /** Character MacGuffins - hidden elements attached to characters */
  characterMacGuffins?: import('../schemas/macguffin.js').CharacterMacGuffin[];
  /** Plot MacGuffins - mysterious plot elements */
  plotMacGuffins?: import('../schemas/macguffin.js').PlotMacGuffin[];
}

// =====================
// Chapter Context Types
// =====================

/**
 * Context from previously generated chapters, used for cross-chapter awareness
 */
export interface ChapterContext {
  /** Completed chapter texts in generation order */
  previousChapterTexts: string[];
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
  narrativeType?: string;
  developedCharacters?: import('../factory/character-developer.js').DevelopedCharacter[];
  /** Theme from ThemeGenerator - passed to Plotter for emotion/timeline/scene_types context */
  theme?: import('../schemas/generated-theme.js').GeneratedTheme;
  /** Theme context for consistent propagation across all agents */
  themeContext?: ThemeContext;
  /** MacGuffins for mystery injection into writers */
  characterMacGuffins?: import('../schemas/macguffin.js').CharacterMacGuffin[];
  plotMacGuffins?: import('../schemas/macguffin.js').PlotMacGuffin[];
  verbose?: boolean;
  mode?: 'tournament' | 'collaboration';
  collaborationConfig?: import('../collaboration/types.js').CollaborationConfig;
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
  synthesized?: boolean;
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

// =====================
// FP Type Aliases
// =====================

import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { NarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';

/**
 * FP Agent Dependencies — shared base for all agents
 */
export interface AgentDeps {
  llmClient: LLMClient;
  soulText: SoulText;
}

/**
 * Corrector agent dependencies
 */
export interface CorrectorDeps extends AgentDeps {
  themeContext?: ThemeContext;
}

/**
 * Writer agent dependencies
 */
export interface WriterDeps extends AgentDeps {
  config: WriterConfig;
  narrativeRules?: NarrativeRules;
  developedCharacters?: DevelopedCharacter[];
  themeContext?: ThemeContext;
  macGuffinContext?: MacGuffinContext;
}

/**
 * FP Corrector interface — returned by createCorrector()
 */
export interface Corrector {
  correct: (text: string, violations: Violation[]) => Promise<CorrectionResult>;
}

/**
 * FP Writer interface — returned by createWriter()
 */
export interface Writer {
  generate: (prompt: string) => Promise<string>;
  generateWithMetadata: (prompt: string) => Promise<GenerationResult>;
  getId: () => string;
  getConfig: () => WriterConfig;
}

/**
 * Judge agent dependencies
 */
export interface JudgeDeps extends AgentDeps {
  narrativeRules?: NarrativeRules;
  themeContext?: ThemeContext;
}

/**
 * FP Judge interface — returned by createJudge()
 */
export interface Judge {
  evaluate: (textA: string, textB: string) => Promise<JudgeResult>;
}

/**
 * Plotter agent dependencies
 */
export interface PlotterDeps extends AgentDeps {
  config: PlotterConfig;
}

/**
 * FP Plotter interface — returned by createPlotter()
 */
export interface Plotter {
  generatePlot: () => Promise<import('../schemas/plot.js').Plot>;
}

/**
 * ReaderEvaluator agent dependencies
 */
export interface ReaderEvaluatorDeps extends AgentDeps {
  persona: import('../schemas/reader-personas.js').ReaderPersona;
}

/**
 * FP ReaderEvaluator interface — returned by createReaderEvaluator()
 */
export interface ReaderEval {
  evaluate: (text: string, previousEvaluation?: PersonaEvaluation) => Promise<PersonaEvaluation>;
}

/**
 * ReaderJury agent dependencies
 */
export interface ReaderJuryDeps extends AgentDeps {
  personas?: import('../schemas/reader-personas.js').ReaderPersona[];
}

/**
 * FP ReaderJury interface — returned by createReaderJury()
 */
export interface ReaderJury {
  evaluate: (text: string, previousResult?: ReaderJuryResult) => Promise<ReaderJuryResult>;
}

/**
 * Synthesis agent dependencies
 */
export interface SynthesisDeps extends AgentDeps {
  narrativeRules?: NarrativeRules;
  themeContext?: ThemeContext;
}

/**
 * FP Synthesis interface — returned by createSynthesisAgent()
 */
export interface Synthesizer {
  synthesize: (championText: string, championId: string, allGenerations: GenerationResult[], rounds: import('../tournament/arena.js').MatchResult[]) => Promise<import('../synthesis/synthesis-agent.js').SynthesisResult>;
}

/**
 * Retake agent dependencies
 */
export interface RetakeDeps extends AgentDeps {
  narrativeRules?: NarrativeRules;
  themeContext?: ThemeContext;
}

/**
 * FP Retake interface — returned by createRetakeAgent()
 */
export interface Retaker {
  retake: (originalText: string, feedback: string) => Promise<import('../retake/retake-agent.js').RetakeResult>;
}
