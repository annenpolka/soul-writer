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
}

/**
 * Simple pipeline that runs a tournament to generate text
 */
export class SimplePipeline {
  private llmClient: LLMClient;
  private soulManager: SoulTextManager;
  private options: SimplePipelineOptions;
  private narrativeRules: NarrativeRules;

  constructor(llmClient: LLMClient, soulManager: SoulTextManager, options: SimplePipelineOptions = {}) {
    this.llmClient = llmClient;
    this.soulManager = soulManager;
    this.options = options;
    this.narrativeRules = options.narrativeRules ?? resolveNarrativeRules();
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
    );

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
      } catch {
        // Synthesis failed, use champion text as-is
      }
    }

    // 2. Compliance check
    const checker = ComplianceChecker.fromSoulText(soulText, this.narrativeRules);
    let complianceResult: ComplianceResult = checker.check(finalText);

    // 3. Correction loop if needed
    if (!complianceResult.isCompliant) {
      const corrector = new CorrectorAgent(this.llmClient, soulText);
      const loop = new CorrectionLoop(corrector, checker, 3);
      const correctionResult = await loop.run(finalText);

      correctionAttempts = correctionResult.attempts;
      finalText = correctionResult.finalText;
      complianceResult = checker.check(finalText);

      if (!correctionResult.success) {
        const collector = new AntiSoulCollector();
        collector.collectFromFailedCorrection(correctionResult);
      }
    }

    // 4. Retake loop
    const retakeAgent = new RetakeAgent(this.llmClient, soulText, this.narrativeRules);
    const judgeAgent = new JudgeAgent(this.llmClient, soulText, this.narrativeRules);
    const retakeLoop = new RetakeLoop(retakeAgent, judgeAgent, DEFAULT_RETAKE_CONFIG);
    const retakeResult = await retakeLoop.run(finalText);
    if (retakeResult.improved) {
      finalText = retakeResult.finalText;
      complianceResult = checker.check(finalText);
    }

    // 5. Reader jury evaluation
    const readerJury = new ReaderJuryAgent(this.llmClient, soulText);
    const readerJuryResult: ReaderJuryResult = await readerJury.evaluate(finalText);

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
