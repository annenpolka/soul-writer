import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import { PlotSchema, type Plot } from '../schemas/plot.js';
import {
  DEFAULT_PLOTTER_CONFIG,
  type PlotterConfig,
  type PlotResult,
} from './types.js';
import { buildPrompt } from '../template/composer.js';

export { type PlotterConfig, type PlotResult };

const SUBMIT_PLOT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_plot',
    description: '物語のプロット構造を提出する',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        theme: { type: 'string' },
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              title: { type: 'string' },
              summary: { type: 'string' },
              key_events: { type: 'array', items: { type: 'string' } },
              target_length: { type: 'number' },
              variation_constraints: {
                type: 'object',
                properties: {
                  structure_type: { type: 'string' },
                  emotional_arc: { type: 'string' },
                  pacing: { type: 'string' },
                  deviation_from_previous: { type: 'string' },
                  motif_budget: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        motif: { type: 'string' },
                        max_uses: { type: 'number' },
                      },
                      required: ['motif', 'max_uses'],
                    },
                  },
                },
                required: ['structure_type', 'emotional_arc', 'pacing'],
              },
              epistemic_constraints: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    perspective: { type: 'string' },
                    constraints: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['perspective', 'constraints'],
                },
              },
            },
            required: ['index', 'title', 'summary', 'key_events', 'target_length'],
          },
        },
      },
      required: ['title', 'theme', 'chapters'],
    },
  },
};

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

    assertToolCallingClient(this.llmClient);
    const response = await this.llmClient.completeWithTools(
      systemPrompt,
      userPrompt,
      [SUBMIT_PLOT_TOOL],
      {
        toolChoice: { type: 'function', function: { name: 'submit_plot' } },
        temperature: this.config.temperature,
      },
    );

    const plot = this.parseToolResponse(response);
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
        tone: t.tone,
        characters: t.characters.map(c => ({
          name: c.name,
          tag: c.isNew ? '（新規）' : '',
          descSuffix: c.description ? `: ${c.description}` : '',
        })),
        scene_types: t.scene_types,
        narrative_type: t.narrative_type,
      };
    }

    // MacGuffins
    if (this.config.plotMacGuffins && this.config.plotMacGuffins.length > 0) {
      ctx.plotMacGuffins = this.config.plotMacGuffins.map(m => ({
        name: m.name,
        surface: m.surfaceAppearance,
        questions: m.tensionQuestions.join('、'),
        hint: m.presenceHint,
      }));
    }
    if (this.config.characterMacGuffins && this.config.characterMacGuffins.length > 0) {
      ctx.characterMacGuffins = this.config.characterMacGuffins.map(m => ({
        name: m.characterName,
        secret: m.secret,
        signs: m.surfaceSigns.join('、'),
      }));
    }

    ctx.chapterInstruction = `${this.config.chapterCount}章構成の物語を設計してください。\n総文字数の目安: ${this.config.targetTotalLength}字`;

    return ctx;
  }

  private parseToolResponse(response: ToolCallResponse): Plot {
    let parsed: unknown;
    try {
      parsed = parseToolArguments<unknown>(response, 'submit_plot');
    } catch {
      throw new Error('Failed to parse tool call arguments');
    }

    const result = PlotSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Plot validation failed: ${result.error.message}`);
    }

    return result.data;
  }
}
