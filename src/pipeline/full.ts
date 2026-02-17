import type { LLMClient } from '../llm/types.js';
import type { SoulTextManagerFn } from '../soul/manager.js';
import type { CheckpointManagerFn } from '../storage/checkpoint-manager.js';
import type { TaskRepo } from '../storage/task-repository.js';
import type { WorkRepo } from '../storage/work-repository.js';
import type { SoulCandidateRepo } from '../storage/soul-candidate-repository.js';
import type { JudgeSessionRepo } from '../storage/judge-session-repository.js';
import type { ChapterEvalRepo } from '../storage/chapter-evaluation-repository.js';
import type { SynthesisPlanRepo } from '../storage/synthesis-plan-repository.js';
import type { CorrectionHistoryRepo } from '../storage/correction-history-repository.js';
import type { CrossChapterStateRepo } from '../storage/cross-chapter-state-repository.js';
import type { PhaseMetricsRepo } from '../storage/phase-metrics-repository.js';
import {
  type FullPipelineConfig,
  type FullPipelineResult,
  type ChapterPipelineResult,
  type ComplianceResult,
  type EvaluationResult,
  type VerdictLevel,
  type ThemeContext,
  type MacGuffinContext,
  type ChapterContext,
  type CrossChapterState,
  type TextWeakness,
  type AxisComment,
  DEFAULT_FULL_PIPELINE_CONFIG,
} from '../agents/types.js';
import type { Plot, Chapter, VariationAxis } from '../schemas/plot.js';
import { createPlotter } from '../agents/plotter.js';
import { createTournamentArena } from '../tournament/arena.js';
import { selectTournamentWriters, DEFAULT_TEMPERATURE_SLOTS, type TemperatureSlot } from '../tournament/persona-pool.js';
import { createCheckerFromSoulText } from '../compliance/checker.js';
import { createCorrector } from '../agents/corrector.js';
import { createCorrectionLoop } from '../correction/loop.js';
import { createDefectDetector } from '../agents/defect-detector.js';
import { createLearningPipeline } from '../learning/learning-pipeline.js';
import { createFragmentExtractor } from '../learning/fragment-extractor.js';
import { createSoulExpander } from '../learning/soul-expander.js';
import { createAntiSoulCollector } from '../learning/anti-soul-collector.js';
import { createRetakeAgent } from '../retake/retake-agent.js';
import { createJudge } from '../agents/judge.js';
import { createWriter } from '../agents/writer.js';
import { createSynthesisV2 } from '../synthesis/synthesis-v2.js';
import { createCollaborationSession } from '../collaboration/session.js';
import { toTournamentResult } from '../collaboration/adapter.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { createCharacterEnricher } from '../factory/character-enricher.js';
import type { EnrichedCharacter } from '../factory/character-enricher.js';
import { buildChapterPrompt } from './chapter-prompt.js';
import { analyzePreviousChapter, extractEstablishedInsights, type PreviousChapterAnalysis, type EstablishedInsight } from './chapter-summary.js';
import { defectResultToReaderJuryResult } from './adapters/defect-to-reader.js';
import { buildRetakeFeedback } from '../evaluation/verdict-utils.js';
import { createChapterStateExtractor } from '../agents/chapter-state-extractor.js';
import { createInitialCrossChapterState, updateCrossChapterState } from './cross-chapter-state.js';
import { filterChineseContamination } from './filters/chinese-filter.js';
import type { LoggerFn } from '../logger.js';

// =====================
// Pure helper functions
// =====================

export function resolveThemeContext(config: FullPipelineConfig): ThemeContext | undefined {
  if (config.themeContext) return config.themeContext;
  if (config.theme) {
    return {
      emotion: config.theme.emotion,
      timeline: config.theme.timeline,
      premise: config.theme.premise,
      tone: config.theme.tone,
      narrative_type: config.theme.narrative_type,
      scene_types: config.theme.scene_types,
    };
  }
  return undefined;
}

export function resolveMacGuffinContext(config: FullPipelineConfig): MacGuffinContext | undefined {
  if (!config.characterMacGuffins && !config.plotMacGuffins) return undefined;
  return {
    characterMacGuffins: config.characterMacGuffins,
    plotMacGuffins: config.plotMacGuffins,
  };
}

export function getTemperatureSlots(soulManager: SoulTextManagerFn): TemperatureSlot[] {
  const config = soulManager.getPromptConfig()?.tournament?.temperature_slots;
  if (!config || config.length === 0) return DEFAULT_TEMPERATURE_SLOTS;
  return config.map(s => ({
    label: s.label,
    range: s.range as [number, number],
    topPRange: s.topP_range as [number, number],
  }));
}

// =====================
// FP API
// =====================

export interface FullPipelineDeps {
  llmClient: LLMClient;
  soulManager: SoulTextManagerFn;
  checkpointManager: CheckpointManagerFn;
  taskRepo: TaskRepo;
  workRepo: WorkRepo;
  candidateRepo: SoulCandidateRepo;
  config: Partial<FullPipelineConfig>;
  logger?: LoggerFn;
  // Optional analytics repositories (non-critical — failures are silently logged)
  judgeSessionRepo?: JudgeSessionRepo;
  chapterEvalRepo?: ChapterEvalRepo;
  synthesisPlanRepo?: SynthesisPlanRepo;
  correctionHistoryRepo?: CorrectionHistoryRepo;
  crossChapterStateRepo?: CrossChapterStateRepo;
  phaseMetricsRepo?: PhaseMetricsRepo;
}

export interface FullPipelineRunner {
  generateStory(prompt: string): Promise<FullPipelineResult>;
  resume(taskId: string): Promise<FullPipelineResult>;
  getConfig(): FullPipelineConfig;
}

export function createFullPipeline(deps: FullPipelineDeps): FullPipelineRunner {
  const config: FullPipelineConfig = { ...DEFAULT_FULL_PIPELINE_CONFIG, ...deps.config };
  const {
    llmClient, soulManager, checkpointManager, taskRepo, workRepo, candidateRepo, logger,
    judgeSessionRepo, chapterEvalRepo, synthesisPlanRepo,
    correctionHistoryRepo, crossChapterStateRepo, phaseMetricsRepo,
  } = deps;

  const chars = config.developedCharacters?.map(c => ({
    name: c.name,
    isNew: c.isNew,
    description: c.description,
  }));
  const narrativeRules = resolveNarrativeRules(config.narrativeType, chars);
  const themeContext = resolveThemeContext(config);
  const macGuffinContext = resolveMacGuffinContext(config);
  const temperatureSlots = getTemperatureSlots(soulManager);

  async function generateChapter(
    chapter: Chapter,
    plot: Plot,
    chapterCtx?: ChapterContext,
    establishedInsights?: EstablishedInsight[],
    enrichedCharacters?: EnrichedCharacter[],
    crossChapterState?: CrossChapterState,
    variationAxis?: VariationAxis,
    previousChapterReasoning?: string | null,
  ): Promise<ChapterPipelineResult> {
    const tokensStart = llmClient.getTotalTokens();

    let previousChapterAnalysis: PreviousChapterAnalysis | undefined;
    if (chapterCtx && chapterCtx.previousChapterTexts.length > 0) {
      const lastText = chapterCtx.previousChapterTexts[chapterCtx.previousChapterTexts.length - 1];
      previousChapterAnalysis = await analyzePreviousChapter(llmClient, lastText);
    }

    const chapterPromptText = buildChapterPrompt({
      chapter,
      plot,
      narrativeType: config.narrativeType,
      narrativeRules,
      developedCharacters: config.developedCharacters,
      enrichedCharacters,
      characterMacGuffins: config.characterMacGuffins,
      plotMacGuffins: config.plotMacGuffins,
      previousChapterAnalysis,
      motifAvoidanceList: config.motifAvoidanceList,
      establishedInsights,
      toneDirective: themeContext?.tone,
      crossChapterState,
      variationAxis,
    });

    const writerPersonas = soulManager.getWriterPersonas();
    const writerConfigs = writerPersonas.length > 0
      ? selectTournamentWriters(writerPersonas, temperatureSlots)
      : undefined;

    let finalText: string;
    let tournamentResult;
    let correctionAttempts = 0;
    let synthesized = false;

    // --- Phase: Tournament / Collaboration ---
    const tournamentPhaseStart = Date.now();
    const tournamentTokensBefore = llmClient.getTotalTokens();

    if (config.mode === 'collaboration') {
      const collabPersonas = soulManager.getCollabPersonas();
      const collabConfigs = collabPersonas.length > 0
        ? selectTournamentWriters(collabPersonas, temperatureSlots)
        : writerConfigs;
      logger?.section('Collaboration Start');
      const session = createCollaborationSession({
        llmClient,
        soulText: soulManager.getSoulText(),
        writerConfigs: collabConfigs ?? [],
        config: config.collaborationConfig,
        themeContext,
        macGuffinContext,
        enrichedCharacters: enrichedCharacters as EnrichedCharacter[] | undefined,
        logger,
      });
      const collabResult = await session.run(chapterPromptText);
      tournamentResult = toTournamentResult(collabResult);
      finalText = collabResult.finalText;
    } else {
      const { DEFAULT_WRITERS } = await import('../agents/types.js');
      const writers = (writerConfigs ?? DEFAULT_WRITERS).map((wc) =>
        createWriter({
          llmClient,
          soulText: soulManager.getSoulText(),
          config: wc,
          narrativeRules,
          developedCharacters: config.developedCharacters,
          enrichedCharacters,
          themeContext,
          macGuffinContext,
          previousChapterReasoning,
        }),
      );
      const arena = createTournamentArena({
        writers,
        createJudge: () =>
          createJudge({
            llmClient,
            soulText: soulManager.getSoulText(),
            narrativeRules,
            themeContext,
          }),
        tokenTracker: { getTokens: () => llmClient.getTotalTokens() },
        logger,
      });
      tournamentResult = await arena.runTournament(chapterPromptText);
      finalText = tournamentResult.championText;
    }

    // Save tournament phase metrics
    if (phaseMetricsRepo) {
      try {
        await phaseMetricsRepo.save({
          workId: null,
          chapterIndex: chapter.index,
          phase: config.mode === 'collaboration' ? 'collaboration' : 'tournament',
          durationMs: Date.now() - tournamentPhaseStart,
          tokensUsed: llmClient.getTotalTokens() - tournamentTokensBefore,
        });
      } catch (err) {
        logger?.debug('Failed to save tournament phase metrics', { error: String(err) });
      }
    }

    // Save judge session results (per-round)
    if (judgeSessionRepo) {
      for (const round of tournamentResult.rounds) {
        try {
          await judgeSessionRepo.save({
            matchId: null,
            scores: (round.judgeResult.scores as Record<string, unknown>) ?? {},
            axisComments: { items: round.judgeResult.axis_comments ?? [] },
            weaknesses: round.judgeResult.weaknesses?.A ?? [],
            sectionAnalysis: round.judgeResult.section_analysis ?? [],
            praisedExcerpts: round.judgeResult.praised_excerpts?.A ?? [],
          });
        } catch (err) {
          logger?.debug('Failed to save judge session', { error: String(err) });
        }
      }
    }

    // Extract Judge analysis data from tournament (needed for Synthesis V2 and DefectDetector)
    const finalRound = tournamentResult.rounds[tournamentResult.rounds.length - 1];
    const judgeResult = finalRound?.judgeResult;
    let judgeWeaknesses: TextWeakness[] = [];
    let judgeAxisComments: AxisComment[] = [];
    let judgeReasoning: string | null = null;
    if (judgeResult) {
      const championKey = finalRound.winner === finalRound.contestantA ? 'A' : 'B';
      judgeWeaknesses = judgeResult.weaknesses?.[championKey] ?? [];
      judgeAxisComments = judgeResult.axis_comments ?? [];
      judgeReasoning = judgeResult.llmReasoning ?? null;
    }

    // --- Phase: Synthesis V2 ---
    if (config.mode !== 'collaboration' && tournamentResult.allGenerations.length > 1) {
      const synthesisPhaseStart = Date.now();
      const synthesisTokensBefore = llmClient.getTotalTokens();

      logger?.section('Synthesis V2');
      const beforeLength = finalText.length;
      try {
        const synthesizer = createSynthesisV2({
          llmClient,
          soulText: soulManager.getSoulText(),
          narrativeRules,
          themeContext,
          macGuffinContext,
        });
        const synthesisResult = await synthesizer.synthesize({
          championText: tournamentResult.championText,
          championId: tournamentResult.champion,
          allGenerations: tournamentResult.allGenerations,
          rounds: tournamentResult.rounds,
          plotContext: { chapter, plot },
          chapterContext: chapterCtx,
          enrichedCharacters: enrichedCharacters as EnrichedCharacter[] | undefined,
          crossChapterState,
          judgeReasoning,
        });
        finalText = synthesisResult.synthesizedText;
        synthesized = true;
        logger?.debug('Synthesis V2 result', { synthesized: true, beforeLength, afterLength: finalText.length });

        // Save synthesis plan
        if (synthesisPlanRepo && synthesisResult.plan) {
          try {
            await synthesisPlanRepo.save({
              chapterId: null,
              championAssessment: synthesisResult.plan.championAssessment ?? '',
              preserveElements: synthesisResult.plan.preserveElements ?? [],
              actions: synthesisResult.plan.actions ?? [],
              expressionSources: synthesisResult.plan.expressionSources ?? [],
            });
          } catch (saveErr) {
            logger?.debug('Failed to save synthesis plan', { error: String(saveErr) });
          }
        }
      } catch (err) {
        console.warn(`Chapter ${chapter.index}: Synthesis V2 failed, using champion text as-is.`, err);
        logger?.debug('Synthesis V2 failed', { error: String(err) });
      }

      // Save synthesis phase metrics
      if (phaseMetricsRepo) {
        try {
          await phaseMetricsRepo.save({
            workId: null,
            chapterIndex: chapter.index,
            phase: 'synthesis',
            durationMs: Date.now() - synthesisPhaseStart,
            tokensUsed: llmClient.getTotalTokens() - synthesisTokensBefore,
          });
        } catch (err) {
          logger?.debug('Failed to save synthesis phase metrics', { error: String(err) });
        }
      }
    }

    // --- Phase: Compliance Check ---
    const compliancePhaseStart = Date.now();
    const complianceTokensBefore = llmClient.getTotalTokens();

    logger?.section('Compliance Check');
    const checker = createCheckerFromSoulText(soulManager.getSoulText(), narrativeRules, llmClient);
    let complianceResult: ComplianceResult = chapterCtx
      ? await checker.checkWithContext(finalText, chapterCtx)
      : checker.check(finalText);
    logger?.debug('Compliance result', complianceResult);

    if (phaseMetricsRepo) {
      try {
        await phaseMetricsRepo.save({
          workId: null,
          chapterIndex: chapter.index,
          phase: 'compliance',
          durationMs: Date.now() - compliancePhaseStart,
          tokensUsed: llmClient.getTotalTokens() - complianceTokensBefore,
        });
      } catch (err) {
        logger?.debug('Failed to save compliance phase metrics', { error: String(err) });
      }
    }

    // --- Phase: Correction Loop ---
    if (!complianceResult.isCompliant) {
      const correctionPhaseStart = Date.now();
      const correctionTokensBefore = llmClient.getTotalTokens();

      logger?.section('Correction Loop');
      const corrector = createCorrector({ llmClient, soulText: soulManager.getSoulText(), themeContext });
      const loop = createCorrectionLoop({ corrector, checker, maxAttempts: config.maxCorrectionAttempts, llmClient });
      const correctionResult = await loop.run(finalText, complianceResult.violations, chapterCtx);

      correctionAttempts = correctionResult.attempts;
      finalText = correctionResult.finalText;
      complianceResult = checker.check(finalText);
      logger?.debug('Correction result', { attempts: correctionAttempts, success: correctionResult.success, finalCompliance: complianceResult });

      if (!correctionResult.success) {
        const collector = createAntiSoulCollector(soulManager.getSoulText().antiSoul);
        collector.collectFromFailedCorrection(correctionResult);
        console.warn(
          `Chapter ${chapter.index}: Correction failed after ${correctionAttempts} attempts. Continuing with best effort.`
        );
      }

      // Save correction phase metrics
      if (phaseMetricsRepo) {
        try {
          await phaseMetricsRepo.save({
            workId: null,
            chapterIndex: chapter.index,
            phase: 'correction',
            durationMs: Date.now() - correctionPhaseStart,
            tokensUsed: llmClient.getTotalTokens() - correctionTokensBefore,
          });
        } catch (err) {
          logger?.debug('Failed to save correction phase metrics', { error: String(err) });
        }
      }

      // Save correction history
      if (correctionHistoryRepo) {
        try {
          await correctionHistoryRepo.save({
            chapterId: null,
            attemptNumber: correctionAttempts,
            violationsCount: complianceResult.violations.length,
            correctedSuccessfully: complianceResult.isCompliant,
            tokensUsed: llmClient.getTotalTokens() - correctionTokensBefore,
          });
        } catch (err) {
          logger?.debug('Failed to save correction history', { error: String(err) });
        }
      }
    }

    const complianceWarnings = complianceResult.violations.filter(v => v.severity === 'warning');

    // --- Phase: DefectDetector Evaluation ---
    const defectPhaseStart = Date.now();
    const defectTokensBefore = llmClient.getTotalTokens();

    logger?.section('DefectDetector Evaluation');
    const detector = createDefectDetector({
      llmClient,
      soulText: soulManager.getSoulText(),
      enrichedCharacters: enrichedCharacters as EnrichedCharacter[] | undefined,
      toneDirective: themeContext?.tone,
      crossChapterState,
      judgeWeaknesses,
      judgeAxisComments,
      complianceWarnings,
      judgeReasoning,
    });
    let defectResult = await detector.detect(finalText);
    logger?.debug('DefectDetector result', defectResult);

    if (phaseMetricsRepo) {
      try {
        await phaseMetricsRepo.save({
          workId: null,
          chapterIndex: chapter.index,
          phase: 'defect_detection',
          durationMs: Date.now() - defectPhaseStart,
          tokensUsed: llmClient.getTotalTokens() - defectTokensBefore,
        });
      } catch (err) {
        logger?.debug('Failed to save defect_detection phase metrics', { error: String(err) });
      }
    }

    const MAX_RETAKES = 2;
    let retakeCount = 0;
    while (!defectResult.passed && retakeCount < MAX_RETAKES) {
      const retakePhaseStart = Date.now();
      const retakeTokensBefore = llmClient.getTotalTokens();

      logger?.section(`DefectDetector Retake ${retakeCount + 1}/${MAX_RETAKES}`);

      const feedback = buildRetakeFeedback(
        defectResult.defects,
        judgeWeaknesses,
        defectResult.verdictLevel,
      );

      // Extract plot chapter info for retake enrichment
      const plotChapter = chapter.summary ? {
        summary: chapter.summary,
        keyEvents: chapter.key_events ?? [],
        decisionPoint: chapter.decision_point,
      } : undefined;

      const retakeAgent = createRetakeAgent({
        llmClient,
        soulText: soulManager.getSoulText(),
        narrativeRules,
        themeContext,
        chapterContext: chapterCtx,
        plotChapter,
        detectorReasoning: defectResult.llmReasoning,
        retakeIteration: retakeCount,
        previousDefectSummary: retakeCount > 0 ? defectResult.feedback : undefined,
      });
      const retakeResult = await retakeAgent.retake(finalText, feedback, defectResult.defects);
      finalText = retakeResult.retakenText;
      complianceResult = checker.check(finalText);
      defectResult = await detector.detect(finalText);
      retakeCount++;
      logger?.debug(`DefectDetector Retake ${retakeCount} result`, defectResult);

      // Save retake phase metrics
      if (phaseMetricsRepo) {
        try {
          await phaseMetricsRepo.save({
            workId: null,
            chapterIndex: chapter.index,
            phase: 'retake',
            durationMs: Date.now() - retakePhaseStart,
            tokensUsed: llmClient.getTotalTokens() - retakeTokensBefore,
          });
        } catch (err) {
          logger?.debug('Failed to save retake phase metrics', { error: String(err) });
        }
      }
    }

    // Save chapter evaluation from DefectDetector
    if (chapterEvalRepo) {
      try {
        await chapterEvalRepo.save({
          chapterId: null,
          verdictLevel: defectResult.verdictLevel,
          defects: defectResult.defects,
          criticalCount: defectResult.criticalCount,
          majorCount: defectResult.majorCount,
          minorCount: defectResult.minorCount,
          feedback: defectResult.feedback,
        });
      } catch (err) {
        logger?.debug('Failed to save chapter evaluation', { error: String(err) });
      }
    }

    // Build EvaluationResult from DefectDetector output
    const evaluationResult: EvaluationResult = {
      defects: defectResult.defects,
      criticalCount: defectResult.criticalCount,
      majorCount: defectResult.majorCount,
      minorCount: defectResult.minorCount,
      verdictLevel: defectResult.verdictLevel,
      passed: defectResult.passed,
      needsRetake: !defectResult.passed,
      feedback: defectResult.feedback,
    };

    // Deprecated compat: maintain readerJuryResult for old checkpoint format
    const readerJuryResult = defectResultToReaderJuryResult(defectResult);

    logger?.debug(`Chapter text (${finalText.length}文字)`, finalText);

    const tokensUsed = llmClient.getTotalTokens() - tokensStart;

    return {
      chapterIndex: chapter.index,
      text: finalText,
      champion: tournamentResult.champion,
      complianceResult,
      correctionAttempts,
      evaluationResult,
      readerJuryResult,
      synthesized,
      tokensUsed,
    };
  }

  async function runLearningPipeline(
    chapterResults: ChapterPipelineResult[],
    workId: string,
    startIndex: number = 0,
  ): Promise<number> {
    const extractor = createFragmentExtractor(llmClient);
    const expander = createSoulExpander(candidateRepo);
    const learning = createLearningPipeline(extractor, expander);
    let learningCandidates = 0;

    for (let i = startIndex; i < chapterResults.length; i++) {
      const chapterResult = chapterResults[i];
      const learningResult = await learning.process({
        soulId: soulManager.getConstitution().meta.soul_id,
        workId,
        text: chapterResult.text,
        isCompliant: chapterResult.complianceResult.isCompliant,
        verdictLevel: chapterResult.evaluationResult.verdictLevel,
        chapterId: undefined,
      });

      chapterResults[i] = { ...chapterResult, learningResult };
      if (learningResult && !learningResult.skipped) {
        learningCandidates += learningResult.added;
      }
    }

    return learningCandidates;
  }

  async function executeStory(taskId: string, _prompt: string): Promise<FullPipelineResult> {
    // Generate plot
    const plotterPhaseStart = Date.now();
    const plotter = createPlotter({
      llmClient,
      soulText: soulManager.getSoulText(),
      config: {
        chapterCount: config.chapterCount,
        targetTotalLength: config.targetTotalLength,
        developedCharacters: config.developedCharacters,
        theme: config.theme,
        plotMacGuffins: config.plotMacGuffins,
        characterMacGuffins: config.characterMacGuffins,
        motifAvoidanceList: config.motifAvoidanceList,
      },
    });
    const tokensBefore = llmClient.getTotalTokens();
    const plot = await plotter.generatePlot();
    const plotTokensUsed = llmClient.getTotalTokens() - tokensBefore;
    let totalTokensUsed = plotTokensUsed;

    // Save plotter phase metrics
    if (phaseMetricsRepo) {
      try {
        await phaseMetricsRepo.save({
          workId: null,
          chapterIndex: 0,
          phase: 'plotter',
          durationMs: Date.now() - plotterPhaseStart,
          tokensUsed: plotTokensUsed,
        });
      } catch (err) {
        logger?.debug('Failed to save plotter phase metrics', { error: String(err) });
      }
    }

    logger?.section('Plot Generated');
    logger?.debug('Plot', {
      title: plot.title,
      theme: plot.theme,
      chapters: plot.chapters.map((c: Chapter) => ({ index: c.index, title: c.title, summary: c.summary })),
      tokensUsed: plotTokensUsed,
    });

    if (themeContext) logger?.debug('ThemeContext', themeContext);
    if (macGuffinContext) logger?.debug('MacGuffinContext', macGuffinContext);

    // Save plot checkpoint
    await checkpointManager.saveCheckpoint(
      taskId,
      'plot_generation',
      { plot, chapters: [] },
      { completedChapters: 0, totalChapters: plot.chapters.length }
    );

    // Phase2 character enrichment: add dialogue samples using plot context
    let enrichedCharacters = config.enrichedCharacters as EnrichedCharacter[] | undefined;
    if (config.enrichedCharacters && config.enrichedCharacters.length > 0) {
      const needsPhase2 = config.enrichedCharacters.some(c => !('dialogueSamples' in c));
      if (needsPhase2) {
        logger?.section('Character Enrichment Phase2');
        const enricher = createCharacterEnricher(llmClient, soulManager.getSoulText());
        const phase1Chars = config.enrichedCharacters.map(c => ({
          name: c.name, isNew: c.isNew, role: c.role,
          description: c.description, voice: c.voice,
          physicalHabits: c.physicalHabits, stance: c.stance,
          dynamics: c.dynamics,
        }));
        const phase2Result = await enricher.enrichPhase2(phase1Chars, plot, config.theme!, config.enricherPhase1Reasoning);
        enrichedCharacters = phase2Result.characters;
        totalTokensUsed += phase2Result.tokensUsed;
        logger?.debug('Characters enriched (Phase2)', enrichedCharacters);
      }
    }

    // Generate each chapter
    const chapterResults: ChapterPipelineResult[] = [];
    let learningCandidates = 0;
    const antiPatternsCollected = 0;
    const chapterCtx: ChapterContext = { previousChapterTexts: [] };
    const established: EstablishedInsight[] = [];
    let crossChapterState = createInitialCrossChapterState();
    let chapterStateReasoning: string | null = null;

    for (const ch of plot.chapters) {
      logger?.section(`Chapter ${ch.index}: ${ch.title}`);
      const chapterResult = await generateChapter(
        ch, plot, chapterCtx, established, enrichedCharacters,
        crossChapterState, ch.variation_axis, chapterStateReasoning,
      );

      // Post-processing: Chinese contamination filter
      chapterResult.text = filterChineseContamination(chapterResult.text);

      chapterResults.push(chapterResult);
      chapterCtx.previousChapterTexts.push(chapterResult.text);
      totalTokensUsed += chapterResult.tokensUsed;

      // WS4: Extract established insights for cumulative differential prompting
      if (plot.chapters.length > 1 && ch.index < plot.chapters.length) {
        try {
          const newInsights = await extractEstablishedInsights(llmClient, chapterResult.text, ch.index);
          established.push(...newInsights);
          logger?.debug(`Established insights after Ch${ch.index}`, newInsights);
        } catch (err) {
          logger?.debug(`Failed to extract insights for Ch${ch.index}`, { error: String(err) });
        }
      }

      // Cross-chapter state extraction (for multi-chapter stories)
      if (plot.chapters.length > 1 && ch.index < plot.chapters.length) {
        const stateExtractionStart = Date.now();
        const stateExtractionTokensBefore = llmClient.getTotalTokens();

        try {
          const extractor = createChapterStateExtractor({
            llmClient,
            soulText: soulManager.getSoulText(),
            previousState: crossChapterState,
          });
          const extraction = await extractor.extract(chapterResult.text, ch.index);
          crossChapterState = updateCrossChapterState(crossChapterState, extraction, ch.index);
          chapterStateReasoning = extraction.llmReasoning ?? null;
          logger?.debug(`Cross-chapter state after Ch${ch.index}`, {
            characterStates: crossChapterState.characterStates.length,
            motifWear: crossChapterState.motifWear.length,
            variationHint: crossChapterState.variationHint,
            hasReasoning: !!chapterStateReasoning,
          });

          // Save cross-chapter state
          if (crossChapterStateRepo) {
            try {
              const lastSummary = crossChapterState.chapterSummaries[crossChapterState.chapterSummaries.length - 1];
              await crossChapterStateRepo.save({
                workId: null,
                chapterIndex: ch.index,
                characterStates: Object.fromEntries(crossChapterState.characterStates.map(cs => [cs.characterName, cs])),
                motifWear: Object.fromEntries(crossChapterState.motifWear.map(mw => [mw.motif, mw])),
                variationHint: crossChapterState.variationHint ?? '',
                chapterSummary: lastSummary?.summary ?? '',
                dominantTone: lastSummary?.dominantTone ?? '',
                peakIntensity: lastSummary?.peakIntensity ?? 0,
              });
            } catch (saveErr) {
              logger?.debug(`Failed to save cross-chapter state for Ch${ch.index}`, { error: String(saveErr) });
            }
          }
        } catch (err) {
          logger?.debug(`Failed to extract chapter state for Ch${ch.index}`, { error: String(err) });
        }

        // Save chapter_state_extraction phase metrics
        if (phaseMetricsRepo) {
          try {
            await phaseMetricsRepo.save({
              workId: null,
              chapterIndex: ch.index,
              phase: 'chapter_state_extraction',
              durationMs: Date.now() - stateExtractionStart,
              tokensUsed: llmClient.getTotalTokens() - stateExtractionTokensBefore,
            });
          } catch (err) {
            logger?.debug('Failed to save chapter_state_extraction phase metrics', { error: String(err) });
          }
        }
      }

      if (chapterResult.learningResult && !chapterResult.learningResult.skipped) {
        learningCandidates += chapterResult.learningResult.added;
      }

      await checkpointManager.saveCheckpoint(
        taskId,
        'chapter_done',
        { plot: plot, chapters: chapterResults },
        { completedChapters: chapterResults.length, totalChapters: plot.chapters.length }
      );
    }

    // Calculate verdict-based metrics
    const compliancePassRate =
      chapterResults.filter(c => c.complianceResult.isCompliant).length / chapterResults.length;
    const verdictDistribution = chapterResults.reduce((dist, c) => {
      const level = c.evaluationResult.verdictLevel;
      dist[level] = (dist[level] || 0) + 1;
      return dist;
    }, {} as Record<VerdictLevel, number>);

    // Determine primary verdict level
    const primaryVerdict = Object.entries(verdictDistribution).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Archive work to database
    const work = await workRepo.create({
      soulId: soulManager.getConstitution().meta.soul_id,
      title: plot.title,
      content: chapterResults.map((c) => c.text).join('\n\n---\n\n'),
      totalChapters: chapterResults.length,
      totalTokens: totalTokensUsed,
      complianceScore: compliancePassRate,
      readerScore: 0,
      compliancePass: compliancePassRate >= 1.0,
      verdictLevel: primaryVerdict,
    });

    // Run learning pipeline
    learningCandidates += await runLearningPipeline(chapterResults, work.id);

    logger?.section('Learning Pipeline Complete');
    logger?.debug('Learning summary', { learningCandidates, antiPatternsCollected });

    // Mark task as completed
    await taskRepo.markCompleted(taskId);

    return {
      taskId,
      plot,
      chapters: chapterResults,
      totalTokensUsed,
      compliancePassRate,
      verdictDistribution,
      learningCandidates,
      antiPatternsCollected,
    };
  }

  async function executeResume(
    taskId: string,
    plot: Plot,
    completedChapters: ChapterPipelineResult[],
    progress: { completedChapters: number; totalChapters: number },
  ): Promise<FullPipelineResult> {
    const chapterResults: ChapterPipelineResult[] = [...completedChapters];
    const remainingChapters = plot.chapters.slice(progress.completedChapters);
    let totalTokensUsed = completedChapters.reduce((sum, c) => sum + c.tokensUsed, 0);
    let learningCandidates = completedChapters.reduce(
      (sum, c) => sum + (c.learningResult?.added || 0),
      0
    );
    const antiPatternsCollected = 0;
    const chapterCtx: ChapterContext = {
      previousChapterTexts: completedChapters.map(c => c.text),
    };
    const established: EstablishedInsight[] = [];

    // Phase2 character enrichment for resume
    let enrichedCharacters = config.enrichedCharacters as EnrichedCharacter[] | undefined;
    if (config.enrichedCharacters && config.enrichedCharacters.length > 0) {
      const needsPhase2 = config.enrichedCharacters.some(c => !('dialogueSamples' in c));
      if (needsPhase2) {
        const enricher = createCharacterEnricher(llmClient, soulManager.getSoulText());
        const phase1Chars = config.enrichedCharacters.map(c => ({
          name: c.name, isNew: c.isNew, role: c.role,
          description: c.description, voice: c.voice,
          physicalHabits: c.physicalHabits, stance: c.stance,
          dynamics: c.dynamics,
        }));
        const phase2Result = await enricher.enrichPhase2(phase1Chars, plot, config.theme!, config.enricherPhase1Reasoning);
        enrichedCharacters = phase2Result.characters;
        totalTokensUsed += phase2Result.tokensUsed;
      }
    }

    // Reconstruct CrossChapterState from completed chapters
    let crossChapterState = createInitialCrossChapterState();
    if (completedChapters.length > 0) {
      for (let i = 0; i < completedChapters.length; i++) {
        try {
          const extractor = createChapterStateExtractor({
            llmClient,
            soulText: soulManager.getSoulText(),
            previousState: crossChapterState,
          });
          const chapterIndex = i + 1;
          const extraction = await extractor.extract(completedChapters[i].text, chapterIndex);
          crossChapterState = updateCrossChapterState(crossChapterState, extraction, chapterIndex);
        } catch {
          // Non-critical: continue with partial state
        }
      }
      logger?.debug('Reconstructed cross-chapter state for resume', {
        characterStates: crossChapterState.characterStates.length,
        motifWear: crossChapterState.motifWear.length,
      });
    }

    let chapterStateReasoning: string | null = null;
    for (const ch of remainingChapters) {
      const chapterResult = await generateChapter(
        ch, plot, chapterCtx, established, enrichedCharacters,
        crossChapterState, ch.variation_axis, chapterStateReasoning,
      );

      // Post-processing: Chinese contamination filter
      chapterResult.text = filterChineseContamination(chapterResult.text);

      chapterResults.push(chapterResult);
      chapterCtx.previousChapterTexts.push(chapterResult.text);
      totalTokensUsed += chapterResult.tokensUsed;

      // WS4: Extract established insights for cumulative differential prompting
      if (plot.chapters.length > 1 && ch.index < plot.chapters.length) {
        try {
          const newInsights = await extractEstablishedInsights(llmClient, chapterResult.text, ch.index);
          established.push(...newInsights);
        } catch {
          // Non-critical: continue without insights
        }
      }

      // Cross-chapter state extraction
      if (plot.chapters.length > 1 && ch.index < plot.chapters.length) {
        const stateExtractionStartResume = Date.now();
        const stateExtractionTokensBeforeResume = llmClient.getTotalTokens();

        try {
          const extractor = createChapterStateExtractor({
            llmClient,
            soulText: soulManager.getSoulText(),
            previousState: crossChapterState,
          });
          const extraction = await extractor.extract(chapterResult.text, ch.index);
          crossChapterState = updateCrossChapterState(crossChapterState, extraction, ch.index);
          chapterStateReasoning = extraction.llmReasoning ?? null;

          // Save cross-chapter state
          if (crossChapterStateRepo) {
            try {
              const lastSummary = crossChapterState.chapterSummaries[crossChapterState.chapterSummaries.length - 1];
              await crossChapterStateRepo.save({
                workId: null,
                chapterIndex: ch.index,
                characterStates: Object.fromEntries(crossChapterState.characterStates.map(cs => [cs.characterName, cs])),
                motifWear: Object.fromEntries(crossChapterState.motifWear.map(mw => [mw.motif, mw])),
                variationHint: crossChapterState.variationHint ?? '',
                chapterSummary: lastSummary?.summary ?? '',
                dominantTone: lastSummary?.dominantTone ?? '',
                peakIntensity: lastSummary?.peakIntensity ?? 0,
              });
            } catch (saveErr) {
              logger?.debug(`Failed to save cross-chapter state for Ch${ch.index}`, { error: String(saveErr) });
            }
          }
        } catch {
          // Non-critical: continue without cross-chapter state
        }

        // Save chapter_state_extraction phase metrics
        if (phaseMetricsRepo) {
          try {
            await phaseMetricsRepo.save({
              workId: null,
              chapterIndex: ch.index,
              phase: 'chapter_state_extraction',
              durationMs: Date.now() - stateExtractionStartResume,
              tokensUsed: llmClient.getTotalTokens() - stateExtractionTokensBeforeResume,
            });
          } catch (err) {
            logger?.debug('Failed to save chapter_state_extraction phase metrics', { error: String(err) });
          }
        }
      }

      if (chapterResult.learningResult && !chapterResult.learningResult.skipped) {
        learningCandidates += chapterResult.learningResult.added;
      }

      await checkpointManager.saveCheckpoint(
        taskId,
        'chapter_done',
        { plot, chapters: chapterResults },
        { completedChapters: chapterResults.length, totalChapters: plot.chapters.length }
      );
    }

    const compliancePassRate =
      chapterResults.filter(c => c.complianceResult.isCompliant).length / chapterResults.length;
    const verdictDistribution = chapterResults.reduce((dist, c) => {
      const level = c.evaluationResult.verdictLevel;
      dist[level] = (dist[level] || 0) + 1;
      return dist;
    }, {} as Record<VerdictLevel, number>);

    const primaryVerdictResume = Object.entries(verdictDistribution).sort((a, b) => b[1] - a[1])[0]?.[0];

    const work = await workRepo.create({
      soulId: soulManager.getConstitution().meta.soul_id,
      title: plot.title,
      content: chapterResults.map((c) => c.text).join('\n\n---\n\n'),
      totalChapters: chapterResults.length,
      totalTokens: totalTokensUsed,
      complianceScore: compliancePassRate,
      readerScore: 0,
      compliancePass: compliancePassRate >= 1.0,
      verdictLevel: primaryVerdictResume,
    });

    learningCandidates += await runLearningPipeline(chapterResults, work.id, progress.completedChapters);

    await taskRepo.markCompleted(taskId);

    return {
      taskId,
      plot,
      chapters: chapterResults,
      totalTokensUsed,
      compliancePassRate,
      verdictDistribution,
      learningCandidates,
      antiPatternsCollected,
    };
  }

  return {
    async generateStory(prompt: string): Promise<FullPipelineResult> {
      const task = await taskRepo.create({
        soulId: soulManager.getConstitution().meta.soul_id,
        params: { prompt, config },
      });
      await taskRepo.markStarted(task.id);

      try {
        return await executeStory(task.id, prompt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await taskRepo.markFailed(task.id, message);
        throw error;
      }
    },

    async resume(taskId: string): Promise<FullPipelineResult> {
      const resumeState = await checkpointManager.getResumeState(taskId);
      if (!resumeState) {
        throw new Error(`No checkpoint found for task: ${taskId}`);
      }

      const plot = resumeState.plot as Plot;
      const rawCompleted = (resumeState.chapters || []) as ChapterPipelineResult[];
      // Backfill evaluationResult for old checkpoint format
      const completed = rawCompleted.map(ch => {
        if (!ch.evaluationResult) {
          return {
            ...ch,
            evaluationResult: {
              defects: [],
              criticalCount: 0,
              majorCount: 0,
              minorCount: 0,
              verdictLevel: 'publishable' as VerdictLevel,
              passed: true,
              needsRetake: false,
              feedback: 'Restored from legacy checkpoint',
            },
          };
        }
        return ch;
      });
      const progress = resumeState._progress as { completedChapters: number; totalChapters: number };

      const task = await taskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      await taskRepo.markStarted(taskId);

      try {
        return await executeResume(taskId, plot, completed, progress);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await taskRepo.markFailed(taskId, message);
        throw error;
      }
    },

    getConfig(): FullPipelineConfig {
      return { ...config };
    },
  };
}

