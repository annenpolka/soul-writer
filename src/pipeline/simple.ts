import type { LLMClient } from '../llm/types.js';
import { SoulTextManager } from '../soul/manager.js';
import { TournamentArena, type TournamentResult } from '../tournament/arena.js';
import { PlotterAgent } from '../agents/plotter.js';
import type { Plot, Chapter } from '../schemas/plot.js';
import type { PlotterConfig } from '../agents/types.js';

/**
 * Result of a pipeline generation (single chapter)
 */
export interface PipelineResult {
  text: string;
  champion: string;
  tournamentResult: TournamentResult;
  tokensUsed: number;
}

/**
 * Result of a chapter generation
 */
export interface ChapterResult extends PipelineResult {
  chapter: Chapter;
}

/**
 * Result of full story generation with plot
 */
export interface FullPipelineResult {
  plot: Plot;
  chapters: ChapterResult[];
  totalTokensUsed: number;
}

/**
 * Simple pipeline that runs a tournament to generate text
 */
export class SimplePipeline {
  private llmClient: LLMClient;
  private soulManager: SoulTextManager;

  constructor(llmClient: LLMClient, soulManager: SoulTextManager) {
    this.llmClient = llmClient;
    this.soulManager = soulManager;
  }

  /**
   * Generate text using tournament competition
   */
  async generate(prompt: string): Promise<PipelineResult> {
    const arena = new TournamentArena(
      this.llmClient,
      this.soulManager.getSoulText()
    );

    const tournamentResult = await arena.runTournament(prompt);

    return {
      text: tournamentResult.championText,
      champion: tournamentResult.champion,
      tournamentResult,
      tokensUsed: tournamentResult.totalTokensUsed,
    };
  }

  /**
   * Generate a full story with plot and multiple chapters
   */
  async generateStory(config?: Partial<PlotterConfig>): Promise<FullPipelineResult> {
    let totalTokensUsed = 0;

    // Step 1: Generate plot
    const plotter = new PlotterAgent(
      this.llmClient,
      this.soulManager.getSoulText(),
      config
    );
    const plotResult = await plotter.generatePlot();
    totalTokensUsed += plotResult.tokensUsed;

    // Step 2: Generate each chapter
    const chapters: ChapterResult[] = [];

    for (const chapter of plotResult.plot.chapters) {
      const chapterPrompt = this.buildChapterPrompt(chapter, plotResult.plot);
      const result = await this.generate(chapterPrompt);

      chapters.push({
        ...result,
        chapter,
      });
      totalTokensUsed += result.tokensUsed;
    }

    return {
      plot: plotResult.plot,
      chapters,
      totalTokensUsed,
    };
  }

  /**
   * Build a prompt for chapter generation
   */
  private buildChapterPrompt(chapter: Chapter, plot: Plot): string {
    const parts: string[] = [];

    parts.push(`# ${plot.title}`);
    parts.push(`テーマ: ${plot.theme}`);
    parts.push('');
    parts.push(`## ${chapter.title}（第${chapter.index}章）`);
    parts.push(`概要: ${chapter.summary}`);
    parts.push('');
    parts.push('### キーイベント');
    for (const event of chapter.key_events) {
      parts.push(`- ${event}`);
    }
    parts.push('');
    parts.push(`目標文字数: ${chapter.target_length}字`);
    parts.push('');
    parts.push('この章を執筆してください。');

    return parts.join('\n');
  }
}
