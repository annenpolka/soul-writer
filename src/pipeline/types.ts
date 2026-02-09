import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { NarrativeRules } from '../factory/narrative-rules.js';
import type { TournamentResult } from '../tournament/arena.js';
import type { ComplianceResult, ReaderJuryResult, ThemeContext, MacGuffinContext, ChapterContext, ImprovementPlan, DefectDetectorResult } from '../agents/types.js';
import type { AntiPattern } from '../learning/anti-soul-collector.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';
import type { EnrichedCharacter } from '../factory/character-enricher.js';
import type { LoggerFn } from '../logger.js';

export interface PipelineContext {
  text: string;
  prompt: string;
  champion?: string;
  tournamentResult?: TournamentResult;
  complianceResult?: ComplianceResult;
  readerJuryResult?: ReaderJuryResult;
  improvementPlan?: ImprovementPlan;
  defectResult?: DefectDetectorResult;
  tokensUsed: number;
  correctionAttempts: number;
  synthesized: boolean;
  readerRetakeCount: number;
  chapterContext?: ChapterContext;
  collectedAntiPatterns?: AntiPattern[];
  deps: PipelineDeps;
}

export interface PipelineDeps {
  llmClient: LLMClient;
  soulText: SoulText;
  narrativeRules: NarrativeRules;
  themeContext?: ThemeContext;
  macGuffinContext?: MacGuffinContext;
  developedCharacters?: DevelopedCharacter[];
  enrichedCharacters?: EnrichedCharacter[];
  motifAvoidanceList?: string[];
  logger?: LoggerFn;
}

export type PipelineStage = (ctx: PipelineContext) => Promise<PipelineContext>;
