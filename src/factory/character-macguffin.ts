import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { CharacterMacGuffinSchema, type CharacterMacGuffin } from '../schemas/macguffin.js';
import { buildPrompt } from '../template/composer.js';

export interface CharacterMacGuffinResult {
  macguffins: CharacterMacGuffin[];
  tokensUsed: number;
}

export class CharacterMacGuffinAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  async generate(theme: GeneratedTheme): Promise<CharacterMacGuffinResult> {
    const tokensBefore = this.llmClient.getTotalTokens();

    const context = this.buildContext(theme);
    const { system: systemPrompt, user: userPrompt } = buildPrompt('character-macguffin', context);
    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.9,
    });

    const macguffins = this.parseResponse(response, theme);
    const tokensUsed = this.llmClient.getTotalTokens() - tokensBefore;

    return { macguffins, tokensUsed };
  }

  private buildContext(theme: GeneratedTheme): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};

    // Existing characters from world-bible
    const characters = this.soulText.worldBible.characters;
    if (Object.keys(characters).length > 0) {
      ctx.existingCharacters = Object.entries(characters).map(([name, char]) => ({
        name,
        role: char.role,
        description: char.description || '',
      }));
    }

    // Theme characters
    ctx.themeCharacters = theme.characters.map(c => ({
      name: c.name,
      isNew: c.isNew,
      tag: c.isNew ? '（新規）' : '（既存）',
      description: c.description || '',
    }));

    ctx.themeInfo = {
      emotion: theme.emotion,
      timeline: theme.timeline,
      premise: theme.premise,
    };

    // Technology context for world-grounded secrets
    const tech = this.soulText.worldBible.technology;
    if (Object.keys(tech).length > 0) {
      ctx.technologyEntries = Object.entries(tech).map(
        ([name, desc]) => ({ name, description: String(desc) }),
      );
    }

    return ctx;
  }

  private parseResponse(response: string, theme: GeneratedTheme): CharacterMacGuffin[] {
    const jsonMatch = response.match(/\[[\s\S]*\]/) || response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.fallback(theme);
    }

    try {
      let raw = JSON.parse(jsonMatch[0]);
      // Handle wrapped format: { characterMacGuffins: [...] }
      if (!Array.isArray(raw) && raw.characterMacGuffins) {
        raw = raw.characterMacGuffins;
      }
      if (!Array.isArray(raw)) {
        raw = [raw];
      }
      const validated = raw.map((item: unknown) => CharacterMacGuffinSchema.safeParse(item))
        .filter((r: { success: boolean }) => r.success)
        .map((r: { success: true; data: CharacterMacGuffin }) => r.data);
      return validated.length > 0 ? validated : this.fallback(theme);
    } catch {
      return this.fallback(theme);
    }
  }

  private fallback(theme: GeneratedTheme): CharacterMacGuffin[] {
    return theme.characters.map(c => ({
      characterName: c.name,
      secret: '不明な過去を持つ',
      surfaceSigns: ['時折見せる不自然な沈黙'],
      narrativeFunction: '物語に不透明さを加える',
    }));
  }
}
