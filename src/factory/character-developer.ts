import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { buildPrompt } from '../template/composer.js';

export interface DevelopedCharacter {
  name: string;
  isNew: boolean;
  role: string;
  description?: string;
  voice?: string;
}

export interface DevelopedCharacters {
  characters: DevelopedCharacter[];
  castingRationale: string;
}

export interface CharacterDevelopResult {
  developed: DevelopedCharacters;
  tokensUsed: number;
}

/**
 * Develops detailed character configurations for a given theme.
 * Ensures character diversity across batch runs.
 */
export class CharacterDeveloperAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  async develop(theme: GeneratedTheme): Promise<CharacterDevelopResult> {
    const tokensBefore = this.llmClient.getTotalTokens();

    const context = this.buildContext(theme);
    const { system: systemPrompt, user: userPrompt } = buildPrompt('character-developer', context);
    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.8,
    });

    const developed = this.parseResponse(response, theme);
    const tokensUsed = this.llmClient.getTotalTokens() - tokensBefore;

    return { developed, tokensUsed };
  }

  private buildContext(theme: GeneratedTheme): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};

    // Existing characters as structured array
    const characters = this.soulText.worldBible.characters;
    if (Object.keys(characters).length > 0) {
      ctx.existingCharacters = Object.entries(characters).map(([name, char]) => {
        const c = char as { role: string; voice?: string };
        return { name, role: c.role, voiceSuffix: c.voice ? `（口調: ${c.voice}）` : '' };
      });
    }

    // Casting rules as structured array
    const castingRules = this.soulText.promptConfig?.agents?.character_developer?.casting_rules;
    if (castingRules) {
      ctx.castingRules = castingRules.map(r => ({ text: r }));
    }
    // If no castingRules, YAML will use default rules via condition

    // Theme info as structured object
    ctx.themeInfo = {
      emotion: theme.emotion,
      timeline: theme.timeline,
      premise: theme.premise,
      narrative_type: theme.narrative_type || '',
    };

    // Theme characters as structured array
    ctx.themeCharacters = theme.characters.map(c => ({
      name: c.name,
      isNew: c.isNew,
      tag: c.isNew ? '（新規）' : '（既存）',
      descSuffix: c.description ? `: ${c.description}` : '',
    }));

    return ctx;
  }

  private parseResponse(response: string, theme: GeneratedTheme): DevelopedCharacters {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.fallback(theme);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.characters) || parsed.characters.length === 0) {
        return this.fallback(theme);
      }

      return {
        characters: parsed.characters.map((c: Record<string, unknown>) => ({
          name: String(c.name || ''),
          isNew: Boolean(c.isNew),
          role: String(c.role || ''),
          description: c.description ? String(c.description) : undefined,
          voice: c.voice ? String(c.voice) : undefined,
        })),
        castingRationale: String(parsed.castingRationale || ''),
      };
    } catch {
      return this.fallback(theme);
    }
  }

  private fallback(theme: GeneratedTheme): DevelopedCharacters {
    return {
      characters: theme.characters.map(c => ({
        name: c.name,
        isNew: c.isNew,
        role: c.description || '',
        description: c.description,
      })),
      castingRationale: 'Fallback: テーマ生成時のキャラクターをそのまま使用',
    };
  }
}
