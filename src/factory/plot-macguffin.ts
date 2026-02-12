import { z } from 'zod';
import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { PlotMacGuffinSchema, type PlotMacGuffin, type CharacterMacGuffin } from '../schemas/macguffin.js';
import { buildPrompt } from '../template/composer.js';

const PlotMacGuffinResponseSchema = z.object({
  plotMacGuffins: z.array(PlotMacGuffinSchema),
});

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

// --- Factory function ---

export function createPlotMacGuffinAgent(llmClient: LLMClient, soulText: SoulText): PlotMacGuffinFn {
  return {
    generate: async (theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Promise<PlotMacGuffinResult> => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildPlotMacGuffinContext(soulText, theme, charMacGuffins);
      const { system: systemPrompt, user: userPrompt } = buildPrompt('plot-macguffin', context);

      let macguffins: PlotMacGuffin[];
      try {
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          PlotMacGuffinResponseSchema,
          { temperature: 1.0 },
        );

        macguffins = response.data.plotMacGuffins.length > 0
          ? response.data.plotMacGuffins
          : plotMacGuffinFallback();
      } catch (e) {
        console.warn('[plot-macguffin] completeStructured failed, using fallback:', e instanceof Error ? e.message : e);
        macguffins = plotMacGuffinFallback();
      }

      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { macguffins, tokensUsed };
    },
  };
}

