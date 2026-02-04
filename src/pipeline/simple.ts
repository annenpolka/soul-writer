import type { LLMClient } from '../llm/types.js';
import { type SoulText, SoulTextManager } from '../soul/manager.js';
import { TournamentArena, type TournamentResult } from '../tournament/arena.js';
import { selectTournamentWriters, DEFAULT_TEMPERATURE_SLOTS } from '../tournament/persona-pool.js';
import type { ComplianceResult, ReaderJuryResult, ThemeContext } from '../agents/types.js';
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
import { CollaborationSession } from '../collaboration/session.js';
import { toTournamentResult } from '../collaboration/adapter.js';
import type { CollaborationConfig } from '../collaboration/types.js';
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
  readerRetakeCount?: number;
}

export interface SimplePipelineOptions {
  simple?: boolean;
  mode?: 'tournament' | 'collaboration';
  collaborationConfig?: Partial<CollaborationConfig>;
  narrativeRules?: NarrativeRules;
  developedCharacters?: DevelopedCharacter[];
  themeContext?: ThemeContext;
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
    if (this.options.mode === 'collaboration') {
      return this.generateWithCollaboration(prompt);
    }

    const soulText = this.soulManager.getSoulText();
    const writerPersonas = this.soulManager.getWriterPersonas();
    const writerConfigs = writerPersonas.length > 0
      ? selectTournamentWriters(writerPersonas, DEFAULT_TEMPERATURE_SLOTS)
      : undefined;
    const arena = new TournamentArena(
      this.llmClient,
      soulText,
      writerConfigs,
      this.narrativeRules,
      this.options.developedCharacters,
      this.options.themeContext,
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
        const synthesizer = new SynthesisAgent(this.llmClient, soulText, this.narrativeRules, this.options.themeContext);
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
      const corrector = new CorrectorAgent(this.llmClient, soulText, this.options.themeContext);
      const loop = new CorrectionLoop(corrector, checker, 3);
      const correctionResult = await loop.run(finalText);

      correctionAttempts = correctionResult.attempts;
      finalText = correctionResult.finalText;
      complianceResult = checker.check(finalText);
      this.logger?.debug('Correction result', { attempts: correctionAttempts, success: correctionResult.success, finalCompliance: complianceResult });

      if (!correctionResult.success) {
        const collector = new AntiSoulCollector(this.soulManager.getSoulText().antiSoul);
        collector.collectFromFailedCorrection(correctionResult);
      }
    }

    // 4. Retake loop
    this.logger?.section('Retake Loop');
    const retakeAgent = new RetakeAgent(this.llmClient, soulText, this.narrativeRules, this.options.themeContext);
    const judgeAgent = new JudgeAgent(this.llmClient, soulText, this.narrativeRules, this.options.themeContext);
    const retakeLoop = new RetakeLoop(retakeAgent, judgeAgent, DEFAULT_RETAKE_CONFIG);
    const retakeResult = await retakeLoop.run(finalText);
    this.logger?.debug('Retake result', { improved: retakeResult.improved, retakeCount: retakeResult.retakeCount });
    if (retakeResult.improved) {
      finalText = retakeResult.finalText;
      complianceResult = checker.check(finalText);
    }

    // 5. Reader jury evaluation with retake loop
    const readerResult = await this.runReaderJuryWithRetake(finalText, soulText, checker);
    finalText = readerResult.finalText;
    complianceResult = readerResult.complianceResult;

    this.logger?.section('Final Text');
    this.logger?.debug(`Final text (${finalText.length}文字)`, finalText);

    return {
      text: finalText,
      champion: tournamentResult.champion,
      tournamentResult,
      tokensUsed: tournamentResult.totalTokensUsed,
      complianceResult,
      readerJuryResult: readerResult.readerJuryResult,
      synthesized,
      correctionAttempts,
      readerRetakeCount: readerResult.readerRetakeCount,
    };
  }

  private async generateWithCollaboration(prompt: string): Promise<PipelineResult> {
    const soulText = this.soulManager.getSoulText();
    const collabPersonas = this.soulManager.getCollabPersonas();
    const writerConfigs = collabPersonas.length > 0
      ? selectTournamentWriters(collabPersonas, DEFAULT_TEMPERATURE_SLOTS)
      : undefined;

    this.logger?.section('Collaboration Start');
    const session = new CollaborationSession(
      this.llmClient,
      soulText,
      writerConfigs ?? [],
      this.options.collaborationConfig,
      this.options.themeContext,
      this.logger,
    );

    const collabResult = await session.run(prompt);
    const tournamentResult = toTournamentResult(collabResult);

    if (this.options.simple) {
      return {
        text: collabResult.finalText,
        champion: 'collaboration',
        tournamentResult,
        tokensUsed: collabResult.totalTokensUsed,
      };
    }

    let finalText = collabResult.finalText;
    let correctionAttempts = 0;

    // Post-processing: compliance check, correction, retake, reader jury
    this.logger?.section('Compliance Check');
    const checker = ComplianceChecker.fromSoulText(soulText, this.narrativeRules);
    let complianceResult: ComplianceResult = checker.check(finalText);

    if (!complianceResult.isCompliant) {
      this.logger?.section('Correction Loop');
      const corrector = new CorrectorAgent(this.llmClient, soulText, this.options.themeContext);
      const loop = new CorrectionLoop(corrector, checker, 3);
      const correctionResult = await loop.run(finalText);
      correctionAttempts = correctionResult.attempts;
      finalText = correctionResult.finalText;
      complianceResult = checker.check(finalText);

      if (!correctionResult.success) {
        const collector = new AntiSoulCollector(this.soulManager.getSoulText().antiSoul);
        collector.collectFromFailedCorrection(correctionResult);
      }
    }

    this.logger?.section('Retake Loop');
    const retakeAgent = new RetakeAgent(this.llmClient, soulText, this.narrativeRules, this.options.themeContext);
    const judgeAgent = new JudgeAgent(this.llmClient, soulText, this.narrativeRules, this.options.themeContext);
    const retakeLoop = new RetakeLoop(retakeAgent, judgeAgent, DEFAULT_RETAKE_CONFIG);
    const retakeResult = await retakeLoop.run(finalText);
    if (retakeResult.improved) {
      finalText = retakeResult.finalText;
      complianceResult = checker.check(finalText);
    }

    const readerResult = await this.runReaderJuryWithRetake(finalText, soulText, checker);
    finalText = readerResult.finalText;
    complianceResult = readerResult.complianceResult;

    return {
      text: finalText,
      champion: 'collaboration',
      tournamentResult,
      tokensUsed: collabResult.totalTokensUsed,
      complianceResult,
      readerJuryResult: readerResult.readerJuryResult,
      correctionAttempts,
      readerRetakeCount: readerResult.readerRetakeCount,
    };
  }

  private async runReaderJuryWithRetake(
    text: string,
    soulText: SoulText,
    checker: ComplianceChecker,
  ): Promise<{
    finalText: string;
    readerJuryResult: ReaderJuryResult;
    complianceResult: ComplianceResult;
    readerRetakeCount: number;
  }> {
    this.logger?.section('Reader Jury Evaluation');
    const readerJury = new ReaderJuryAgent(this.llmClient, soulText);
    let readerJuryResult: ReaderJuryResult = await readerJury.evaluate(text);
    this.logger?.debug('Reader Jury result', readerJuryResult);

    let finalText = text;
    let complianceResult = checker.check(finalText);
    let readerRetakeCount = 0;

    const MAX_READER_RETAKES = 2;
    const feedbackHistory: string[] = [];
    for (let i = 0; i < MAX_READER_RETAKES && !readerJuryResult.passed; i++) {
      this.logger?.section(`Reader Jury Retake ${i + 1}/${MAX_READER_RETAKES}`);
      const prevScore = readerJuryResult.aggregatedScore;
      const prevText = finalText;
      const prevResult = readerJuryResult;

      const currentFeedback = readerJuryResult.evaluations
        .map((e) => `${e.personaName}:\n  [良] ${e.feedback.strengths}\n  [課題] ${e.feedback.weaknesses}\n  [提案] ${e.feedback.suggestion}`)
        .join('\n');
      feedbackHistory.push(currentFeedback);

      const feedbackMessage = feedbackHistory.length === 1
        ? `読者陪審員から以下のフィードバックを受けました。改善してください:\n${currentFeedback}`
        : `読者陪審員から複数回のフィードバックを受けています。前回の改善点も踏まえて修正してください:\n\n` +
          feedbackHistory.map((fb, idx) => `【第${idx + 1}回レビュー】\n${fb}`).join('\n\n');

      const retakeAgent = new RetakeAgent(this.llmClient, soulText, this.narrativeRules, this.options.themeContext);
      const retakeResult = await retakeAgent.retake(finalText, feedbackMessage);
      finalText = retakeResult.retakenText;
      complianceResult = checker.check(finalText);
      readerJuryResult = await readerJury.evaluate(finalText, readerJuryResult);
      readerRetakeCount++;

      this.logger?.debug(`Reader Jury Retake ${i + 1} result`, readerJuryResult);

      if (readerJuryResult.aggregatedScore <= prevScore) {
        this.logger?.debug(`Reader Jury Retake aborted: score degraded (${prevScore.toFixed(3)} → ${readerJuryResult.aggregatedScore.toFixed(3)})`);
        finalText = prevText;
        readerJuryResult = prevResult;
        complianceResult = checker.check(finalText);
        break;
      }
    }

    return { finalText, readerJuryResult, complianceResult, readerRetakeCount };
  }
}
