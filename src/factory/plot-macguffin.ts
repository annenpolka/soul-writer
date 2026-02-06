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

// --- FP interface ---

export interface PlotMacGuffinFn {
  generate: (theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]) => Promise<PlotMacGuffinResult>;
}

// --- Internal helpers ---

function buildPlotMacGuffinContext(soulText: SoulText, theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};

  ctx.themeInfo = {
    emotion: theme.emotion,
    timeline: theme.timeline,
    premise: theme.premise,
    tone: theme.tone,
    scene_types: theme.scene_types,
  };

  const tech = soulText.worldBible.technology;
  if (Object.keys(tech).length > 0) {
    ctx.technologyEntries = Object.entries(tech).map(
      ([name, desc]) => ({ name, description: String(desc) }),
    );
  }

  const society = soulText.worldBible.society;
  if (Object.keys(society).length > 0) {
    ctx.societyEntries = Object.entries(society).map(
      ([name, desc]) => ({ name, description: String(desc) }),
    );
  }

  if (charMacGuffins && charMacGuffins.length > 0) {
    ctx.characterSecrets = charMacGuffins.map(m => ({
      name: m.characterName,
      secret: m.secret,
    }));
  }

  return ctx;
}

function plotMacGuffinFallback(): PlotMacGuffin[] {
  return [{
    name: '説明のつかない現象',
    surfaceAppearance: 'システムの一時的な異常として処理される',
    hiddenLayer: '誰かの意図的な介入の可能性',
    tensionQuestions: ['なぜこのタイミングで起きたのか'],
    presenceHint: '物語の転換点付近',
  }];
}

function parsePlotMacGuffinToolResponse(response: ToolCallResponse): PlotMacGuffin[] {
  let raw: unknown;
  try {
    raw = parseToolArguments<unknown>(response, 'submit_plot_macguffins');
  } catch {
    return plotMacGuffinFallback();
  }

  const items = Array.isArray(raw) ? raw : (raw as { plotMacGuffins?: unknown }).plotMacGuffins;
  if (!Array.isArray(items)) {
    return plotMacGuffinFallback();
  }

  const validated = items.map((item: unknown) => PlotMacGuffinSchema.safeParse(item))
    .filter((r: { success: boolean }) => r.success)
    .map((r: { success: true; data: PlotMacGuffin }) => r.data);
  return validated.length > 0 ? validated : plotMacGuffinFallback();
}

// --- Factory function ---

export function createPlotMacGuffinAgent(llmClient: LLMClient, soulText: SoulText): PlotMacGuffinFn {
  return {
    generate: async (theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Promise<PlotMacGuffinResult> => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildPlotMacGuffinContext(soulText, theme, charMacGuffins);
      const { system: systemPrompt, user: userPrompt } = buildPrompt('plot-macguffin', context);
      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_PLOT_MACGUFFINS_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_plot_macguffins' } },
          temperature: 0.9,
        },
      );

      const macguffins = parsePlotMacGuffinToolResponse(response);
      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { macguffins, tokensUsed };
    },
  };
}

