import type { LLMClient } from '../llm/types.js';
import type { SoulTextManager } from '../soul/manager.js';
import type { CheckpointManager } from '../storage/checkpoint-manager.js';
import type { TaskRepository } from '../storage/task-repository.js';
import type { WorkRepository } from '../storage/work-repository.js';
import type { SoulCandidateRepository } from '../storage/soul-candidate-repository.js';
import {
  type FullPipelineConfig,
  type FullPipelineResult,
  type ChapterPipelineResult,
  type ComplianceResult,
  type ReaderJuryResult,
  DEFAULT_FULL_PIPELINE_CONFIG,
} from '../agents/types.js';
import type { Plot, Chapter } from '../schemas/plot.js';
import { PlotterAgent } from '../agents/plotter.js';
import { TournamentArena } from '../tournament/arena.js';
import { ComplianceChecker } from '../compliance/checker.js';
import { CorrectorAgent } from '../agents/corrector.js';
import { CorrectionLoop } from '../correction/loop.js';
import { ReaderJuryAgent } from '../agents/reader-jury.js';
import { LearningPipeline } from '../learning/learning-pipeline.js';
import { FragmentExtractor } from '../learning/fragment-extractor.js';
import { SoulExpander } from '../learning/soul-expander.js';
import { AntiSoulCollector } from '../learning/anti-soul-collector.js';
import { RetakeAgent } from '../retake/retake-agent.js';
import { RetakeLoop, DEFAULT_RETAKE_CONFIG } from '../retake/retake-loop.js';
import { JudgeAgent } from '../agents/judge.js';
import { SynthesisAgent } from '../synthesis/synthesis-agent.js';
import { resolveNarrativeRules, type NarrativeRules } from '../factory/narrative-rules.js';
import type { Logger } from '../logger.js';

/**
 * Full pipeline that integrates all generation, compliance, evaluation, and learning features
 */
export class FullPipeline {
  private llmClient: LLMClient;
  private soulManager: SoulTextManager;
  private checkpointManager: CheckpointManager;
  private taskRepo: TaskRepository;
  private workRepo: WorkRepository;
  private candidateRepo: SoulCandidateRepository;
  private config: FullPipelineConfig;
  private logger?: Logger;

  constructor(
    llmClient: LLMClient,
    soulManager: SoulTextManager,
    checkpointManager: CheckpointManager,
    taskRepo: TaskRepository,
    workRepo: WorkRepository,
    candidateRepo: SoulCandidateRepository,
    config: Partial<FullPipelineConfig> = {},
    logger?: Logger,
  ) {
    this.llmClient = llmClient;
    this.soulManager = soulManager;
    this.checkpointManager = checkpointManager;
    this.taskRepo = taskRepo;
    this.workRepo = workRepo;
    this.candidateRepo = candidateRepo;
    this.config = { ...DEFAULT_FULL_PIPELINE_CONFIG, ...config };
    this.logger = logger;
    // Convert developedCharacters to Character[] for narrative rules resolution
    const chars = this.config.developedCharacters?.map(c => ({
      name: c.name,
      isNew: c.isNew,
      description: c.description,
    }));
    this.narrativeRules = resolveNarrativeRules(this.config.narrativeType, chars);
  }

  private narrativeRules: NarrativeRules;

  /**
   * Generate a full story with all pipeline features
   */
  async generateStory(prompt: string): Promise<FullPipelineResult> {
    // 1. Create task in database
    const task = await this.taskRepo.create({
      soulId: this.soulManager.getConstitution().meta.soul_id,
      params: { prompt, config: this.config },
    });
    await this.taskRepo.markStarted(task.id);

    try {
      return await this._executeStory(task.id, prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.taskRepo.markFailed(task.id, message);
      throw error;
    }
  }

  private async _executeStory(taskId: string, prompt: string): Promise<FullPipelineResult> {
    // 2. Generate plot
    const plotter = new PlotterAgent(this.llmClient, this.soulManager.getSoulText(), {
      chapterCount: this.config.chapterCount,
      targetTotalLength: this.config.targetTotalLength,
      developedCharacters: this.config.developedCharacters,
      theme: this.config.theme,
      plotMacGuffins: this.config.plotMacGuffins,
      characterMacGuffins: this.config.characterMacGuffins,
    });
    const plotResult = await plotter.generatePlot();
    let totalTokensUsed = plotResult.tokensUsed;

    this.logger?.section('Plot Generated');
    this.logger?.debug('Plot', {
      title: plotResult.plot.title,
      theme: plotResult.plot.theme,
      chapters: plotResult.plot.chapters.map(c => ({ index: c.index, title: c.title, summary: c.summary })),
      tokensUsed: plotResult.tokensUsed,
    });

    // 3. Save plot checkpoint
    await this.checkpointManager.saveCheckpoint(
      taskId,
      'plot_generation',
      { plot: plotResult.plot, chapters: [] },
      { completedChapters: 0, totalChapters: plotResult.plot.chapters.length }
    );

    // 4. Generate each chapter
    const chapterResults: ChapterPipelineResult[] = [];
    let learningCandidates = 0;
    let antiPatternsCollected = 0;

    for (const chapter of plotResult.plot.chapters) {
      this.logger?.section(`Chapter ${chapter.index}: ${chapter.title}`);
      const chapterResult = await this.generateChapter(chapter, plotResult.plot);
      chapterResults.push(chapterResult);
      totalTokensUsed += chapterResult.tokensUsed;

      // Track learning candidates
      if (chapterResult.learningResult && !chapterResult.learningResult.skipped) {
        learningCandidates += chapterResult.learningResult.added;
      }

      // Save checkpoint after each chapter
      await this.checkpointManager.saveCheckpoint(
        taskId,
        'chapter_done',
        { plot: plotResult.plot, chapters: chapterResults },
        { completedChapters: chapterResults.length, totalChapters: plotResult.plot.chapters.length }
      );
    }

    // 5. Calculate average scores
    const avgComplianceScore =
      chapterResults.reduce((sum, c) => sum + c.complianceResult.score, 0) / chapterResults.length;
    const avgReaderScore =
      chapterResults.reduce((sum, c) => sum + c.readerJuryResult.aggregatedScore, 0) /
      chapterResults.length;

    // 6. Archive work to database
    const work = await this.workRepo.create({
      soulId: this.soulManager.getConstitution().meta.soul_id,
      title: plotResult.plot.title,
      content: chapterResults.map((c) => c.text).join('\n\n---\n\n'),
      totalChapters: chapterResults.length,
      totalTokens: totalTokensUsed,
      complianceScore: avgComplianceScore,
      readerScore: avgReaderScore,
    });

    // 7. Run learning pipeline for each high-quality chapter (now that work exists)
    const extractor = new FragmentExtractor(this.llmClient);
    const expander = new SoulExpander(this.candidateRepo);
    const learningPipeline = new LearningPipeline(extractor, expander);

    for (let i = 0; i < chapterResults.length; i++) {
      const chapterResult = chapterResults[i];
      const learningResult = await learningPipeline.process({
        soulId: this.soulManager.getConstitution().meta.soul_id,
        workId: work.id,
        text: chapterResult.text,
        complianceScore: chapterResult.complianceResult.score,
        readerScore: chapterResult.readerJuryResult.aggregatedScore,
        chapterId: `chapter_${chapterResult.chapterIndex}`,
      });

      // Update chapter result with learning result
      chapterResults[i] = { ...chapterResult, learningResult };

      if (learningResult && !learningResult.skipped) {
        learningCandidates += learningResult.added;
      }
    }

    this.logger?.section('Learning Pipeline Complete');
    this.logger?.debug('Learning summary', { learningCandidates, antiPatternsCollected });

    // 8. Mark task as completed
    await this.taskRepo.markCompleted(taskId);

    return {
      taskId: taskId,
      plot: plotResult.plot,
      chapters: chapterResults,
      totalTokensUsed,
      avgComplianceScore,
      avgReaderScore,
      learningCandidates,
      antiPatternsCollected,
    };
  }

  /**
   * Resume a previously interrupted story generation
   */
  async resume(taskId: string): Promise<FullPipelineResult> {
    // 1. Get latest checkpoint
    const resumeState = await this.checkpointManager.getResumeState(taskId);
    if (!resumeState) {
      throw new Error(`No checkpoint found for task: ${taskId}`);
    }

    // 2. Extract saved state
    const plot = resumeState.plot as Plot;
    const completedChapters = (resumeState.chapters || []) as ChapterPipelineResult[];
    const progress = resumeState._progress as { completedChapters: number; totalChapters: number };

    // 3. Get task and mark as running again
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    await this.taskRepo.markStarted(taskId);

    try {
      return await this._executeResume(taskId, plot, completedChapters, progress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.taskRepo.markFailed(taskId, message);
      throw error;
    }
  }

  private async _executeResume(
    taskId: string,
    plot: Plot,
    completedChapters: ChapterPipelineResult[],
    progress: { completedChapters: number; totalChapters: number },
  ): Promise<FullPipelineResult> {
    // 4. Continue from next chapter
    const chapterResults: ChapterPipelineResult[] = [...completedChapters];
    const remainingChapters = plot.chapters.slice(progress.completedChapters);
    let totalTokensUsed = completedChapters.reduce((sum, c) => sum + c.tokensUsed, 0);
    let learningCandidates = completedChapters.reduce(
      (sum, c) => sum + (c.learningResult?.added || 0),
      0
    );
    const antiPatternsCollected = 0;

    for (const chapter of remainingChapters) {
      const chapterResult = await this.generateChapter(chapter, plot);
      chapterResults.push(chapterResult);
      totalTokensUsed += chapterResult.tokensUsed;

      if (chapterResult.learningResult && !chapterResult.learningResult.skipped) {
        learningCandidates += chapterResult.learningResult.added;
      }

      await this.checkpointManager.saveCheckpoint(
        taskId,
        'chapter_done',
        { plot, chapters: chapterResults },
        { completedChapters: chapterResults.length, totalChapters: plot.chapters.length }
      );
    }

    // 5. Calculate average scores
    const avgComplianceScore =
      chapterResults.reduce((sum, c) => sum + c.complianceResult.score, 0) / chapterResults.length;
    const avgReaderScore =
      chapterResults.reduce((sum, c) => sum + c.readerJuryResult.aggregatedScore, 0) /
      chapterResults.length;

    // 6. Archive work to database
    const work = await this.workRepo.create({
      soulId: this.soulManager.getConstitution().meta.soul_id,
      title: plot.title,
      content: chapterResults.map((c) => c.text).join('\n\n---\n\n'),
      totalChapters: chapterResults.length,
      totalTokens: totalTokensUsed,
      complianceScore: avgComplianceScore,
      readerScore: avgReaderScore,
    });

    // 7. Run learning pipeline for newly generated chapters
    const extractor = new FragmentExtractor(this.llmClient);
    const expander = new SoulExpander(this.candidateRepo);
    const learningPipeline = new LearningPipeline(extractor, expander);

    for (let i = progress.completedChapters; i < chapterResults.length; i++) {
      const chapterResult = chapterResults[i];
      const learningResult = await learningPipeline.process({
        soulId: this.soulManager.getConstitution().meta.soul_id,
        workId: work.id,
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

    // 8. Mark task as completed
    await this.taskRepo.markCompleted(taskId);

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

  /**
   * Generate a single chapter with compliance check, correction, and reader evaluation
   */
  protected async generateChapter(
    chapter: Chapter,
    plot: Plot
  ): Promise<ChapterPipelineResult> {
    const tokensStart = this.llmClient.getTotalTokens();

    // 1. Run tournament
    const arena = new TournamentArena(this.llmClient, this.soulManager.getSoulText(), undefined, this.narrativeRules, this.config.developedCharacters, this.logger);
    const chapterPrompt = this.buildChapterPrompt(chapter, plot);
    const tournamentResult = await arena.runTournament(chapterPrompt);

    let finalText = tournamentResult.championText;
    let correctionAttempts = 0;
    let synthesized = false;

    // 1.5. Synthesis: enhance champion using elements from all entries
    if (tournamentResult.allGenerations.length > 1) {
      this.logger?.section('Synthesis');
      const beforeLength = finalText.length;
      try {
        const synthesizer = new SynthesisAgent(this.llmClient, this.soulManager.getSoulText(), this.narrativeRules);
        const synthesisResult = await synthesizer.synthesize(
          tournamentResult.championText,
          tournamentResult.champion,
          tournamentResult.allGenerations,
          tournamentResult.rounds,
        );
        finalText = synthesisResult.synthesizedText;
        synthesized = true;
        this.logger?.debug('Synthesis result', { synthesized: true, beforeLength, afterLength: finalText.length });
      } catch (err) {
        console.warn(`Chapter ${chapter.index}: Synthesis failed, using champion text as-is.`, err);
        this.logger?.debug('Synthesis failed', { error: String(err) });
      }
    }

    // 2. Compliance check
    this.logger?.section('Compliance Check');
    const checker = ComplianceChecker.fromSoulText(this.soulManager.getSoulText(), this.narrativeRules);
    let complianceResult: ComplianceResult = checker.check(finalText);
    this.logger?.debug('Compliance result', complianceResult);

    // 3. Correction loop if needed
    if (!complianceResult.isCompliant) {
      this.logger?.section('Correction Loop');
      const corrector = new CorrectorAgent(this.llmClient, this.soulManager.getSoulText());
      const loop = new CorrectionLoop(corrector, checker, this.config.maxCorrectionAttempts);
      const correctionResult = await loop.run(finalText);

      correctionAttempts = correctionResult.attempts;
      finalText = correctionResult.finalText;
      complianceResult = checker.check(finalText);
      this.logger?.debug('Correction result', { attempts: correctionAttempts, success: correctionResult.success, finalCompliance: complianceResult });

      // 4. Collect anti-patterns if correction failed
      if (!correctionResult.success) {
        const collector = new AntiSoulCollector();
        collector.collectFromFailedCorrection(correctionResult);
        console.warn(
          `Chapter ${chapter.index}: Correction failed after ${correctionAttempts} attempts. Continuing with best effort.`
        );
      }
    }

    // 5. Retake loop (post-tournament, pre-reader-jury)
    this.logger?.section('Retake Loop');
    const retakeAgent = new RetakeAgent(this.llmClient, this.soulManager.getSoulText(), this.narrativeRules);
    const judgeAgent = new JudgeAgent(this.llmClient, this.soulManager.getSoulText(), this.narrativeRules);
    const retakeLoop = new RetakeLoop(retakeAgent, judgeAgent, DEFAULT_RETAKE_CONFIG);
    const retakeResult = await retakeLoop.run(finalText);
    this.logger?.debug('Retake result', { improved: retakeResult.improved, retakeCount: retakeResult.retakeCount });
    if (retakeResult.improved) {
      finalText = retakeResult.finalText;
      // Re-check compliance after retake
      complianceResult = checker.check(finalText);
    }

    // 6. Reader jury evaluation (with retake loop on failure, max 2 retakes)
    this.logger?.section('Reader Jury Evaluation');
    const readerJury = new ReaderJuryAgent(this.llmClient, this.soulManager.getSoulText());
    let readerJuryResult: ReaderJuryResult = await readerJury.evaluate(finalText);
    this.logger?.debug('Reader Jury result', readerJuryResult);

    const MAX_READER_RETAKES = 2;
    for (let readerRetake = 0; readerRetake < MAX_READER_RETAKES && !readerJuryResult.passed; readerRetake++) {
      this.logger?.section(`Reader Jury Retake ${readerRetake + 1}/${MAX_READER_RETAKES}`);
      const prevScore = readerJuryResult.aggregatedScore;
      const prevText = finalText;
      const prevResult = readerJuryResult;

      // Build feedback from reader evaluations
      const readerFeedback = readerJuryResult.evaluations
        .map((e) => `${e.personaName}: ${e.feedback}`)
        .join('\n');

      // Retake using reader feedback
      const readerRetakeAgent = new RetakeAgent(this.llmClient, this.soulManager.getSoulText(), this.narrativeRules);
      const retakeResult2 = await readerRetakeAgent.retake(finalText, `読者陪審員から以下のフィードバックを受けました。改善してください:\n${readerFeedback}`);
      finalText = retakeResult2.retakenText;

      // Re-check compliance after retake
      complianceResult = checker.check(finalText);

      // Re-evaluate with reader jury
      readerJuryResult = await readerJury.evaluate(finalText);
      this.logger?.debug(`Reader Jury Retake ${readerRetake + 1} result`, readerJuryResult);

      // Abort if score degraded — revert to previous text
      if (readerJuryResult.aggregatedScore <= prevScore) {
        this.logger?.debug(`Reader Jury Retake aborted: score degraded (${prevScore.toFixed(3)} → ${readerJuryResult.aggregatedScore.toFixed(3)})`);
        finalText = prevText;
        readerJuryResult = prevResult;
        complianceResult = checker.check(finalText);
        break;
      }
    }

    this.logger?.debug(`Chapter text (${finalText.length}文字)`, finalText);

    // Note: Learning pipeline is executed after work is archived (in generateStory/resume)
    // to satisfy foreign key constraint on work_id

    const tokensUsed = this.llmClient.getTotalTokens() - tokensStart;

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

  /**
   * Build a prompt for chapter generation
   */
  protected buildChapterPrompt(chapter: Chapter, plot: Plot): string {
    const parts: string[] = [];

    parts.push(`# ${plot.title}`);
    parts.push(`テーマ: ${plot.theme}`);
    parts.push('');

    // Inject narrative rules
    if (this.config.narrativeType) {
      parts.push(`## ナラティブ`);
      parts.push(`- 型: ${this.config.narrativeType}`);
      parts.push(`- ${this.narrativeRules.povDescription}`);
      parts.push('');
    }

    // Inject developed characters
    if (this.config.developedCharacters && this.config.developedCharacters.length > 0) {
      parts.push('## 登場人物');
      for (const c of this.config.developedCharacters) {
        const tag = c.isNew ? '（新規）' : '（既存）';
        parts.push(`- ${c.name}${tag}: ${c.role}`);
        if (c.description) parts.push(`  背景: ${c.description}`);
        if (c.voice) parts.push(`  口調: ${c.voice}`);
      }
      parts.push('');
    }

    parts.push(`## ${chapter.title}（第${chapter.index}章）`);
    parts.push(`概要: ${chapter.summary}`);
    parts.push('');
    parts.push('### キーイベント');
    for (const event of chapter.key_events) {
      parts.push(`- ${event}`);
    }
    parts.push('');
    // Inject character MacGuffins as surface signs
    if (this.config.characterMacGuffins && this.config.characterMacGuffins.length > 0) {
      parts.push('## キャラクターの秘密（表出サインとして描写に織り込むこと）');
      for (const m of this.config.characterMacGuffins) {
        parts.push(`- ${m.characterName}: ${m.surfaceSigns.join('、')}`);
      }
      parts.push('');
    }

    // Inject plot MacGuffins as tension questions
    if (this.config.plotMacGuffins && this.config.plotMacGuffins.length > 0) {
      parts.push('## 物語の謎（解決不要、雰囲気として漂わせること）');
      for (const m of this.config.plotMacGuffins) {
        parts.push(`- ${m.name}: ${m.tensionQuestions.join('、')}（${m.presenceHint}）`);
      }
      parts.push('');
    }

    parts.push(`目標文字数: ${chapter.target_length}字`);
    parts.push('');
    parts.push('この章を執筆してください。');

    return parts.join('\n');
  }

  /**
   * Get current configuration
   */
  getConfig(): FullPipelineConfig {
    return { ...this.config };
  }
}
