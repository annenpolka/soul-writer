import type { LLMClient } from '../llm/types.js';
import { SoulTextManager } from '../soul/manager.js';
import { TournamentArena, type TournamentResult } from '../tournament/arena.js';
import type { ComplianceResult, ReaderJuryResult } from '../agents/types.js';
import { type NarrativeRules, resolveNarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';
import { ComplianceChecker } from '../compliance/checker.js';
import { CorrectorAgent } from '../agents/corrector.js';
import { CorrectionLoop } from '../correction/loop.js';
import { RetakeAgent } from '../retake/retake-agent.js';
import { RetakeLoop, DEFAULT_RETAKE_CONFIG } from '../retake/retake-loop.js';
import { JudgeAgent } from '../agents/judge.js';
import { ReaderJuryAgent } from '../agents/reader-jury.js';
import { SynthesisAgent } from '../synthesis/synthesis-agent.js';
import { AntiSoulCollector } from '../learning/anti-soul-collector.js';
import type { Logger } from '../logger.js';

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
}

export interface SimplePipelineOptions {
  simple?: boolean;
  narrativeRules?: NarrativeRules;
  developedCharacters?: DevelopedCharacter[];
  verbose?: boolean;
  logger?: Logger;
}

/**
 * Simple pipeline that runs a tournament to generate text
 */
export class SimplePipeline {
  private llmClient: LLMClient;
  private soulManager: SoulTextManager;
  private options: SimplePipelineOptions;
  private narrativeRules: NarrativeRules;
  private logger?: Logger;

  constructor(llmClient: LLMClient, soulManager: SoulTextManager, options: SimplePipelineOptions = {}) {
    this.llmClient = llmClient;
    this.soulManager = soulManager;
    this.options = options;
    this.narrativeRules = options.narrativeRules ?? resolveNarrativeRules();
    this.logger = options.logger;
  }

  /**
   * Generate text using tournament competition with optional post-processing
   */
  async generate(prompt: string): Promise<PipelineResult> {
    const soulText = this.soulManager.getSoulText();
    const arena = new TournamentArena(
      this.llmClient,
      soulText,
      undefined,
      this.narrativeRules,
      this.options.developedCharacters,
      this.logger,
    );

    this.logger?.section('Tournament Start');
    const tournamentResult = await arena.runTournament(prompt);

    // Simple mode: return tournament result only
    if (this.options.simple) {
      return {
        text: tournamentResult.championText,
        champion: tournamentResult.champion,
        tournamentResult,
        tokensUsed: tournamentResult.totalTokensUsed,
      };
    }

    let finalText = tournamentResult.championText;
    let synthesized = false;
    let correctionAttempts = 0;

    // 1. Synthesis
    if (tournamentResult.allGenerations.length > 1) {
      this.logger?.section('Synthesis');
      const beforeLength = finalText.length;
      try {
        const synthesizer = new SynthesisAgent(this.llmClient, soulText, this.narrativeRules);
        const synthesisResult = await synthesizer.synthesize(
          tournamentResult.championText,
          tournamentResult.champion,
          tournamentResult.allGenerations,
          tournamentResult.rounds,
        );
        finalText = synthesisResult.synthesizedText;
        synthesized = true;
        this.logger?.debug('Synthesis result', { synthesized: true, beforeLength, afterLength: finalText.length });
      } catch {
        this.logger?.debug('Synthesis failed, using champion text as-is');
      }
    }

    // 2. Compliance check
    this.logger?.section('Compliance Check');
    const checker = ComplianceChecker.fromSoulText(soulText, this.narrativeRules);
    let complianceResult: ComplianceResult = checker.check(finalText);
    this.logger?.debug('Compliance result', complianceResult);

    // 3. Correction loop if needed
    if (!complianceResult.isCompliant) {
      this.logger?.section('Correction Loop');
      const corrector = new CorrectorAgent(this.llmClient, soulText);
      const loop = new CorrectionLoop(corrector, checker, 3);
      const correctionResult = await loop.run(finalText);

      correctionAttempts = correctionResult.attempts;
      finalText = correctionResult.finalText;
      complianceResult = checker.check(finalText);
      this.logger?.debug('Correction result', { attempts: correctionAttempts, success: correctionResult.success, finalCompliance: complianceResult });

      if (!correctionResult.success) {
        const collector = new AntiSoulCollector();
        collector.collectFromFailedCorrection(correctionResult);
      }
    }

    // 4. Retake loop
    this.logger?.section('Retake Loop');
    const retakeAgent = new RetakeAgent(this.llmClient, soulText, this.narrativeRules);
    const judgeAgent = new JudgeAgent(this.llmClient, soulText, this.narrativeRules);
    const retakeLoop = new RetakeLoop(retakeAgent, judgeAgent, DEFAULT_RETAKE_CONFIG);
    const retakeResult = await retakeLoop.run(finalText);
    this.logger?.debug('Retake result', { improved: retakeResult.improved, retakeCount: retakeResult.retakeCount });
    if (retakeResult.improved) {
      finalText = retakeResult.finalText;
      complianceResult = checker.check(finalText);
    }

    // 5. Reader jury evaluation
    this.logger?.section('Reader Jury Evaluation');
    const readerJury = new ReaderJuryAgent(this.llmClient, soulText);
    const readerJuryResult: ReaderJuryResult = await readerJury.evaluate(finalText);
    this.logger?.debug('Reader Jury result', readerJuryResult);

    this.logger?.section('Final Text');
    this.logger?.debug(`Final text (${finalText.length}文字)`, finalText);

    return {
      text: finalText,
      champion: tournamentResult.champion,
      tournamentResult,
      tokensUsed: tournamentResult.totalTokensUsed,
      complianceResult,
      readerJuryResult,
      synthesized,
      correctionAttempts,
    };
  }
}
