import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { PlotSchema, type Plot } from '../schemas/plot.js';
import {
  DEFAULT_PLOTTER_CONFIG,
  type PlotterConfig,
  type PlotResult,
} from './types.js';
import { buildPrompt } from '../template/composer.js';

export { type PlotterConfig, type PlotResult };

/**
 * Plotter agent that generates plot structures for stories
 */
export class PlotterAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private config: PlotterConfig;

  constructor(
    llmClient: LLMClient,
    soulText: SoulText,
    config: Partial<PlotterConfig> = {}
  ) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.config = { ...DEFAULT_PLOTTER_CONFIG, ...config };
  }

  getConfig(): PlotterConfig {
    return { ...this.config };
  }

  /**
   * Generate a plot structure for a story
   */
  async generatePlot(): Promise<PlotResult> {
    const tokensBefore = this.llmClient.getTotalTokens();

    const context = this.buildContext();
    const { system: systemPrompt, user: userPrompt } = buildPrompt('plotter', context);

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: this.config.temperature,
    });

    const plot = this.parseResponse(response);
    const tokensAfter = this.llmClient.getTotalTokens();

    return {
      plot,
      tokensUsed: tokensAfter - tokensBefore,
    };
  }

  private buildContext(): Record<string, unknown> {
    const thematic = this.soulText.constitution.universal.thematic_constraints;
    const ctx: Record<string, unknown> = {};

    // Thematic constraints
    if (thematic.must_preserve.length > 0) {
      ctx.thematicMustPreserve = thematic.must_preserve;
    }

    // Characters - developed or world-bible fallback
    if (this.config.developedCharacters && this.config.developedCharacters.length > 0) {
      ctx.developedCharacters = this.config.developedCharacters.map(c => ({
        ...c,
        tag: c.isNew ? '（新規）' : '（既存）',
        descriptionLine: c.description ? `\n  背景: ${c.description}` : '',
      }));
    } else {
      const characters = this.soulText.worldBible.characters;
      if (Object.keys(characters).length > 0) {
        ctx.worldBibleCharacters = Object.entries(characters).map(
          ([name, char]) => ({ name, role: char.role, description: char.description || '' }),
        );
      }
    }

    // Technology
    const tech = this.soulText.worldBible.technology;
    if (Object.keys(tech).length > 0) {
      ctx.technologyEntries = Object.entries(tech).map(
        ([name, desc]) => ({ name, description: String(desc) }),
      );
    }

    // Theme info (structured)
    if (this.config.theme) {
      const t = this.config.theme;
      ctx.themeInfo = {
        emotion: t.emotion,
        timeline: t.timeline,
        premise: t.premise,
        characters: t.characters.map(c => ({
          name: c.name,
          tag: c.isNew ? '（新規）' : '',
          descSuffix: c.description ? `: ${c.description}` : '',
        })),
        scene_types: t.scene_types,
        narrative_type: t.narrative_type,
      };
    }

    ctx.chapterInstruction = `${this.config.chapterCount}章構成の物語を設計してください。\n総文字数の目安: ${this.config.targetTotalLength}字`;

    return ctx;
  }

  private parseResponse(response: string): Plot {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse JSON response');
    }

    const result = PlotSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Plot validation failed: ${result.error.message}`);
    }

    return result.data;
  }
}
