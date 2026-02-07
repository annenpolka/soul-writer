import type { LLMClient } from '../llm/types.js';
import type { SoulTextManagerFn } from '../soul/manager.js';
import type { CheckpointManagerFn } from '../storage/checkpoint-manager.js';
import type { TaskRepo } from '../storage/task-repository.js';
import type { WorkRepo } from '../storage/work-repository.js';
import type { SoulCandidateRepo } from '../storage/soul-candidate-repository.js';
import {
  type FullPipelineConfig,
  type FullPipelineResult,
  type ChapterPipelineResult,
  type ComplianceResult,
  type ReaderJuryResult,
  type ThemeContext,
  type MacGuffinContext,
  type ChapterContext,
  DEFAULT_FULL_PIPELINE_CONFIG,
} from '../agents/types.js';
import type { Plot, Chapter } from '../schemas/plot.js';
import { createPlotter } from '../agents/plotter.js';
import { createTournamentArena } from '../tournament/arena.js';
import { selectTournamentWriters, DEFAULT_TEMPERATURE_SLOTS, type TemperatureSlot } from '../tournament/persona-pool.js';
import { createCheckerFromSoulText } from '../compliance/checker.js';
import { createCorrector } from '../agents/corrector.js';
import { createCorrectionLoop } from '../correction/loop.js';
import { createReaderJury } from '../agents/reader-jury.js';
import { createLearningPipeline } from '../learning/learning-pipeline.js';
import { createFragmentExtractor } from '../learning/fragment-extractor.js';
import { createSoulExpander } from '../learning/soul-expander.js';
import { createAntiSoulCollector } from '../learning/anti-soul-collector.js';
import { createRetakeAgent } from '../retake/retake-agent.js';
import { createRetakeLoop, DEFAULT_RETAKE_CONFIG } from '../retake/retake-loop.js';
import { createJudge } from '../agents/judge.js';
import { createWriter } from '../agents/writer.js';
import { createSynthesisAgent } from '../synthesis/synthesis-agent.js';
import { createCollaborationSession } from '../collaboration/session.js';
import { toTournamentResult } from '../collaboration/adapter.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildChapterPrompt } from './chapter-prompt.js';
import { analyzePreviousChapter, type PreviousChapterAnalysis } from './chapter-summary.js';
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
}

export interface FullPipelineRunner {
  generateStory(prompt: string): Promise<FullPipelineResult>;
  resume(taskId: string): Promise<FullPipelineResult>;
  getConfig(): FullPipelineConfig;
}

export function createFullPipeline(deps: FullPipelineDeps): FullPipelineRunner {
  const config: FullPipelineConfig = { ...DEFAULT_FULL_PIPELINE_CONFIG, ...deps.config };
  const { llmClient, soulManager, checkpointManager, taskRepo, workRepo, candidateRepo, logger } = deps;

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
      characterMacGuffins: config.characterMacGuffins,
      plotMacGuffins: config.plotMacGuffins,
      previousChapterAnalysis,
    });

    const writerPersonas = soulManager.getWriterPersonas();
    const writerConfigs = writerPersonas.length > 0
      ? selectTournamentWriters(writerPersonas, temperatureSlots)
      : undefined;

    let finalText: string;
    let tournamentResult;
    let correctionAttempts = 0;
    let synthesized = false;

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
          themeContext,
          macGuffinContext,
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

      if (tournamentResult.allGenerations.length > 1) {
        logger?.section('Synthesis');
        const beforeLength = finalText.length;
        try {
          const synthesizer = createSynthesisAgent({ llmClient, soulText: soulManager.getSoulText(), narrativeRules, themeContext });
          const synthesisResult = await synthesizer.synthesize(
            tournamentResult.championText,
            tournamentResult.champion,
            tournamentResult.allGenerations,
            tournamentResult.rounds,
          );
          finalText = synthesisResult.synthesizedText;
          synthesized = true;
          logger?.debug('Synthesis result', { synthesized: true, beforeLength, afterLength: finalText.length });
        } catch (err) {
          console.warn(`Chapter ${chapter.index}: Synthesis failed, using champion text as-is.`, err);
          logger?.debug('Synthesis failed', { error: String(err) });
        }
      }
    }

    // Compliance check (with async rules and chapter context)
    logger?.section('Compliance Check');
    const checker = createCheckerFromSoulText(soulManager.getSoulText(), narrativeRules, llmClient);
    let complianceResult: ComplianceResult = chapterCtx
      ? await checker.checkWithContext(finalText, chapterCtx)
      : checker.check(finalText);
    logger?.debug('Compliance result', complianceResult);

    // Correction loop if needed
    if (!complianceResult.isCompliant) {
      logger?.section('Correction Loop');
      const corrector = createCorrector({ llmClient, soulText: soulManager.getSoulText(), themeContext });
      const loop = createCorrectionLoop({ corrector, checker, maxAttempts: config.maxCorrectionAttempts });
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
    }

    // Retake loop (post-tournament, pre-reader-jury)
    logger?.section('Retake Loop');
    const retakeAgent = createRetakeAgent({ llmClient, soulText: soulManager.getSoulText(), narrativeRules, themeContext });
    const judgeAgent = createJudge({ llmClient, soulText: soulManager.getSoulText(), narrativeRules, themeContext });
    const retakeLoop = createRetakeLoop({ retaker: retakeAgent, judge: judgeAgent, config: DEFAULT_RETAKE_CONFIG });
    const retakeResult = await retakeLoop.run(finalText);
    logger?.debug('Retake result', { improved: retakeResult.improved, retakeCount: retakeResult.retakeCount });
    if (retakeResult.improved) {
      finalText = retakeResult.finalText;
      complianceResult = checker.check(finalText);
    }

    // Reader jury evaluation (with retake loop on failure, max 2 retakes)
    logger?.section('Reader Jury Evaluation');
    const readerJury = createReaderJury({ llmClient, soulText: soulManager.getSoulText() });
    let readerJuryResult: ReaderJuryResult = await readerJury.evaluate(finalText);
    logger?.debug('Reader Jury result', readerJuryResult);

    const MAX_READER_RETAKES = 2;
    const feedbackHistory: string[] = [];
    for (let readerRetake = 0; readerRetake < MAX_READER_RETAKES && !readerJuryResult.passed; readerRetake++) {
      logger?.section(`Reader Jury Retake ${readerRetake + 1}/${MAX_READER_RETAKES}`);
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

      const readerRetakeAgent = createRetakeAgent({ llmClient, soulText: soulManager.getSoulText(), narrativeRules, themeContext });
      const retakeResult2 = await readerRetakeAgent.retake(finalText, feedbackMessage);
      finalText = retakeResult2.retakenText;

      complianceResult = checker.check(finalText);
      readerJuryResult = await readerJury.evaluate(finalText, readerJuryResult);
      logger?.debug(`Reader Jury Retake ${readerRetake + 1} result`, readerJuryResult);

      if (readerJuryResult.aggregatedScore <= prevScore) {
        logger?.debug(`Reader Jury Retake aborted: score degraded (${prevScore.toFixed(3)} → ${readerJuryResult.aggregatedScore.toFixed(3)})`);
        finalText = prevText;
        readerJuryResult = prevResult;
        complianceResult = checker.check(finalText);
        break;
      }
    }

    logger?.debug(`Chapter text (${finalText.length}文字)`, finalText);

    const tokensUsed = llmClient.getTotalTokens() - tokensStart;

    return {
      chapterIndex: chapter.index,
      text: finalText,
      champion: tournamentResult.champion,
      complianceResult,
      correctionAttempts,
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
        complianceScore: chapterResult.complianceResult.score,
        readerScore: chapterResult.readerJuryResult.aggregatedScore,
        chapterId: `chapter_${chapterResult.chapterIndex}`,
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
      },
    });
    const tokensBefore = llmClient.getTotalTokens();
    const plot = await plotter.generatePlot();
    const plotTokensUsed = llmClient.getTotalTokens() - tokensBefore;
    let totalTokensUsed = plotTokensUsed;

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

    // Generate each chapter
    const chapterResults: ChapterPipelineResult[] = [];
    let learningCandidates = 0;
    const antiPatternsCollected = 0;
    const chapterCtx: ChapterContext = { previousChapterTexts: [] };

    for (const ch of plot.chapters) {
      logger?.section(`Chapter ${ch.index}: ${ch.title}`);
      const chapterResult = await generateChapter(ch, plot, chapterCtx);
      chapterResults.push(chapterResult);
      chapterCtx.previousChapterTexts.push(chapterResult.text);
      totalTokensUsed += chapterResult.tokensUsed;

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

    // Calculate average scores
    const avgComplianceScore =
      chapterResults.reduce((sum, c) => sum + c.complianceResult.score, 0) / chapterResults.length;
    const avgReaderScore =
      chapterResults.reduce((sum, c) => sum + c.readerJuryResult.aggregatedScore, 0) / chapterResults.length;

    // Archive work to database
    const work = await workRepo.create({
      soulId: soulManager.getConstitution().meta.soul_id,
      title: plot.title,
      content: chapterResults.map((c) => c.text).join('\n\n---\n\n'),
      totalChapters: chapterResults.length,
      totalTokens: totalTokensUsed,
      complianceScore: avgComplianceScore,
      readerScore: avgReaderScore,
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
      avgComplianceScore,
      avgReaderScore,
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

    for (const ch of remainingChapters) {
      const chapterResult = await generateChapter(ch, plot, chapterCtx);
      chapterResults.push(chapterResult);
      chapterCtx.previousChapterTexts.push(chapterResult.text);
      totalTokensUsed += chapterResult.tokensUsed;

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

    const avgComplianceScore =
      chapterResults.reduce((sum, c) => sum + c.complianceResult.score, 0) / chapterResults.length;
    const avgReaderScore =
      chapterResults.reduce((sum, c) => sum + c.readerJuryResult.aggregatedScore, 0) / chapterResults.length;

    const work = await workRepo.create({
      soulId: soulManager.getConstitution().meta.soul_id,
      title: plot.title,
      content: chapterResults.map((c) => c.text).join('\n\n---\n\n'),
      totalChapters: chapterResults.length,
      totalTokens: totalTokensUsed,
      complianceScore: avgComplianceScore,
      readerScore: avgReaderScore,
    });

    learningCandidates += await runLearningPipeline(chapterResults, work.id, progress.completedChapters);

    await taskRepo.markCompleted(taskId);

    return {
      taskId,
      plot,
      chapters: chapterResults,
      totalTokensUsed,
      avgComplianceScore,
      avgReaderScore,
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
      const completed = (resumeState.chapters || []) as ChapterPipelineResult[];
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

