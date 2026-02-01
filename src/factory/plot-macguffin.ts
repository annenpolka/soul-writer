import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { PlotMacGuffinSchema, type PlotMacGuffin, type CharacterMacGuffin } from '../schemas/macguffin.js';
import { buildPrompt } from '../template/composer.js';

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
    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.9,
    });

    const macguffins = this.parseResponse(response);
    const tokensUsed = this.llmClient.getTotalTokens() - tokensBefore;

    return { macguffins, tokensUsed };
  }

  private buildContext(theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};

    ctx.themeInfo = {
      emotion: theme.emotion,
      timeline: theme.timeline,
      premise: theme.premise,
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

  private parseResponse(response: string): PlotMacGuffin[] {
    const jsonMatch = response.match(/\[[\s\S]*\]/) || response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.fallback();
    }

    try {
      let raw = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(raw) && raw.plotMacGuffins) {
        raw = raw.plotMacGuffins;
      }
      if (!Array.isArray(raw)) {
        raw = [raw];
      }
      const validated = raw.map((item: unknown) => PlotMacGuffinSchema.safeParse(item))
        .filter((r: { success: boolean }) => r.success)
        .map((r: { success: true; data: PlotMacGuffin }) => r.data);
      return validated.length > 0 ? validated : this.fallback();
    } catch {
      return this.fallback();
    }
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
