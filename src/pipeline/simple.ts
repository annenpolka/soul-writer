import type { LLMClient } from '../llm/types.js';
import type { SoulTextManagerFn } from '../soul/manager.js';
import type { TournamentResult } from '../tournament/arena.js';
import { selectTournamentWriters, DEFAULT_TEMPERATURE_SLOTS } from '../tournament/persona-pool.js';
import type { ComplianceResult, ReaderJuryResult, ThemeContext, MacGuffinContext, WriterConfig } from '../agents/types.js';
import { type NarrativeRules, resolveNarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';
import type { CollaborationConfig } from '../collaboration/types.js';
import type { LoggerFn } from '../logger.js';
import { pipe, when, tryStage } from './compose.js';
import { createTournamentStage } from './stages/tournament.js';
import { createComplianceStage } from './stages/compliance.js';
import { createCorrectionStage } from './stages/correction.js';
import { createSynthesisStage } from './stages/synthesis.js';
import { createJudgeRetakeStage } from './stages/judge-retake.js';
import { createAntiSoulCollectionStage } from './stages/anti-soul-collection.js';
import { createReaderJuryRetakeLoopStage } from './stages/reader-jury-retake-loop.js';
import { createCollaborationStage } from './stages/collaboration.js';
import type { PipelineStage, PipelineContext, PipelineDeps } from './types.js';

/**
 * Result of a pipeline generation (single chapter)
 */
export interface PipelineResult {
  text: string;
  champion: string;
  tournamentResult: TournamentResult;
  tokensUsed: number;
  complianceResult?: ComplianceResult;
  readerJuryResult?: ReaderJuryResult;
  synthesized?: boolean;
  correctionAttempts?: number;
  readerRetakeCount?: number;
}

export interface SimplePipelineOptions {
  simple?: boolean;
  mode?: 'tournament' | 'collaboration';
  collaborationConfig?: Partial<CollaborationConfig>;
  narrativeRules?: NarrativeRules;
  developedCharacters?: DevelopedCharacter[];
  themeContext?: ThemeContext;
  macGuffinContext?: MacGuffinContext;
  verbose?: boolean;
  logger?: LoggerFn;
}

// =====================
// FP API
// =====================

export interface SimplePipelineConfig {
  writerConfigs?: WriterConfig[];
  maxCorrectionAttempts?: number;
  simple?: boolean;
  mode?: 'tournament' | 'collaboration';
  collaborationConfig?: Partial<CollaborationConfig>;
}

/**
 * Create a composable pipeline stage for single-chapter generation.
 *
 * In simple mode: only runs the generation stage (tournament or collaboration).
 * In full mode: generation → synthesis → compliance → correction → anti-soul collection →
 *               judge retake → reader jury retake loop.
 */
export function createSimplePipeline(config: SimplePipelineConfig = {}): PipelineStage {
  const maxCorrections = config.maxCorrectionAttempts ?? 3;
  const isCollaboration = config.mode === 'collaboration';

  // Choose the generation stage based on mode
  const generationStage: PipelineStage = isCollaboration
    ? createCollaborationStage({
        writerConfigs: config.writerConfigs,
        collaborationConfig: config.collaborationConfig,
      })
    : createTournamentStage(config.writerConfigs ?? []);

  if (config.simple) {
    // Simple mode: generation only
    return generationStage;
  }

  // Full mode: generation → post-processing pipeline
  return pipe(
    generationStage,
    tryStage(createSynthesisStage()),
    createComplianceStage(),
    when(ctx => !!(ctx.complianceResult && !ctx.complianceResult.isCompliant), createCorrectionStage(maxCorrections)),
    createAntiSoulCollectionStage(),
    createJudgeRetakeStage(),
    createReaderJuryRetakeLoopStage(),
  );
}

/**
 * Generate text using tournament competition with optional post-processing.
 */
export async function generateSimple(
  llmClient: LLMClient,
  soulManager: SoulTextManagerFn,
  prompt: string,
  options: SimplePipelineOptions = {},
): Promise<PipelineResult> {
  const soulText = soulManager.getSoulText();
  const isCollaboration = options.mode === 'collaboration';
  const narrativeRules = options.narrativeRules ?? resolveNarrativeRules();
  const logger = options.logger;

  // Resolve writer configs from personas
  const writerConfigs = isCollaboration
    ? resolveCollabWriterConfigs(soulManager)
    : resolveTournamentWriterConfigs(soulManager);

  // Build the composable pipeline
  const pipeline = createSimplePipeline({
    writerConfigs,
    maxCorrectionAttempts: 3,
    simple: options.simple,
    mode: options.mode,
    collaborationConfig: options.collaborationConfig,
  });

  // Build initial context
  const deps: PipelineDeps = {
    llmClient,
    soulText,
    narrativeRules,
    themeContext: options.themeContext,
    macGuffinContext: options.macGuffinContext,
    logger,
  };

  const initialContext: PipelineContext = {
    text: '',
    prompt,
    tokensUsed: 0,
    correctionAttempts: 0,
    synthesized: false,
    readerRetakeCount: 0,
    deps,
  };

  // Log context info
  if (options.themeContext) {
    logger?.debug('ThemeContext', options.themeContext);
  }
  if (options.macGuffinContext) {
    logger?.debug('MacGuffinContext', options.macGuffinContext);
  }

  // Run the pipeline
  const result = await pipeline(initialContext);

  return {
    text: result.text,
    champion: result.champion ?? 'unknown',
    tournamentResult: result.tournamentResult!,
    tokensUsed: result.tokensUsed,
    complianceResult: result.complianceResult,
    readerJuryResult: result.readerJuryResult,
    synthesized: result.synthesized || undefined,
    correctionAttempts: result.correctionAttempts || undefined,
    readerRetakeCount: result.readerRetakeCount || undefined,
  };
}

function resolveTournamentWriterConfigs(soulManager: SoulTextManagerFn): WriterConfig[] | undefined {
  const writerPersonas = soulManager.getWriterPersonas();
  return writerPersonas.length > 0
    ? selectTournamentWriters(writerPersonas, DEFAULT_TEMPERATURE_SLOTS)
    : undefined;
}

function resolveCollabWriterConfigs(soulManager: SoulTextManagerFn): WriterConfig[] | undefined {
  const collabPersonas = soulManager.getCollabPersonas();
  return collabPersonas.length > 0
    ? selectTournamentWriters(collabPersonas, DEFAULT_TEMPERATURE_SLOTS)
    : undefined;
}
