import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { PlotMacGuffinSchema, type PlotMacGuffin, type CharacterMacGuffin } from '../schemas/macguffin.js';
import { buildPrompt } from '../template/composer.js';

const SUBMIT_PLOT_MACGUFFINS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_plot_macguffins',
    description: 'プロット用のマクガフィンを提出する',
    parameters: {
      type: 'object',
      properties: {
        plotMacGuffins: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              surfaceAppearance: { type: 'string' },
              hiddenLayer: { type: 'string' },
              tensionQuestions: { type: 'array', items: { type: 'string' } },
              presenceHint: { type: 'string' },
            },
            required: ['name', 'surfaceAppearance', 'hiddenLayer', 'tensionQuestions', 'presenceHint'],
            additionalProperties: false,
          },
        },
      },
      required: ['plotMacGuffins'],
      additionalProperties: false,
    },
    strict: true,
  },
};

export interface PlotMacGuffinResult {
  macguffins: PlotMacGuffin[];
  tokensUsed: number;
}

export class PlotMacGuffinAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  async generate(theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Promise<PlotMacGuffinResult> {
    const tokensBefore = this.llmClient.getTotalTokens();

    const context = this.buildContext(theme, charMacGuffins);
    const { system: systemPrompt, user: userPrompt } = buildPrompt('plot-macguffin', context);
    assertToolCallingClient(this.llmClient);
    const response = await this.llmClient.completeWithTools(
      systemPrompt,
      userPrompt,
      [SUBMIT_PLOT_MACGUFFINS_TOOL],
      {
        toolChoice: { type: 'function', function: { name: 'submit_plot_macguffins' } },
        temperature: 0.9,
      },
    );

    const macguffins = this.parseToolResponse(response);
    const tokensUsed = this.llmClient.getTotalTokens() - tokensBefore;

    return { macguffins, tokensUsed };
  }

  private buildContext(theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};

    ctx.themeInfo = {
      emotion: theme.emotion,
      timeline: theme.timeline,
      premise: theme.premise,
      tone: theme.tone,
      scene_types: theme.scene_types,
    };

    // Technology for world-grounded mysteries
    const tech = this.soulText.worldBible.technology;
    if (Object.keys(tech).length > 0) {
      ctx.technologyEntries = Object.entries(tech).map(
        ([name, desc]) => ({ name, description: String(desc) }),
      );
    }

    // Society
    const society = this.soulText.worldBible.society;
    if (Object.keys(society).length > 0) {
      ctx.societyEntries = Object.entries(society).map(
        ([name, desc]) => ({ name, description: String(desc) }),
      );
    }

    // Character secrets for interweaving
    if (charMacGuffins && charMacGuffins.length > 0) {
      ctx.characterSecrets = charMacGuffins.map(m => ({
        name: m.characterName,
        secret: m.secret,
      }));
    }

    return ctx;
  }

  private parseToolResponse(response: ToolCallResponse): PlotMacGuffin[] {
    let raw: unknown;
    try {
      raw = parseToolArguments<unknown>(response, 'submit_plot_macguffins');
    } catch {
      return this.fallback();
    }

    const items = Array.isArray(raw) ? raw : (raw as { plotMacGuffins?: unknown }).plotMacGuffins;
    if (!Array.isArray(items)) {
      return this.fallback();
    }

    const validated = items.map((item: unknown) => PlotMacGuffinSchema.safeParse(item))
      .filter((r: { success: boolean }) => r.success)
      .map((r: { success: true; data: PlotMacGuffin }) => r.data);
    return validated.length > 0 ? validated : this.fallback();
  }

  private fallback(): PlotMacGuffin[] {
    return [{
      name: '説明のつかない現象',
      surfaceAppearance: 'システムの一時的な異常として処理される',
      hiddenLayer: '誰かの意図的な介入の可能性',
      tensionQuestions: ['なぜこのタイミングで起きたのか'],
      presenceHint: '物語の転換点付近',
    }];
  }
}
