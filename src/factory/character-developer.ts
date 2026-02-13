import { z } from 'zod';
import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import type { CharacterMacGuffin } from '../schemas/macguffin.js';
import { buildPrompt } from '../template/composer.js';

const LLMCharacterResponseSchema = z.object({
  characters: z.array(z.object({
    name: z.string().default(''),
    isNew: z.boolean().default(false),
    role: z.string().default(''),
    description: z.string().default(''),
    voice: z.string().default(''),
  })),
  castingRationale: z.string().default(''),
});

export interface DevelopedCharacter {
  name: string;
  isNew: boolean;
  role: string;
  description: string;
  voice: string;
}

export interface DevelopedCharacters {
  characters: DevelopedCharacter[];
  castingRationale: string;
}

export interface CharacterDevelopResult {
  developed: DevelopedCharacters;
  tokensUsed: number;
}

// --- FP interface ---

export interface CharacterDeveloperFn {
  develop: (theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]) => Promise<CharacterDevelopResult>;
}

// --- Internal helpers ---

function buildCharDevContext(soulText: SoulText, theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};

  const characters = soulText.worldBible.characters;
  if (Object.keys(characters).length > 0) {
    ctx.existingCharacters = Object.entries(characters).map(([name, char]) => {
      return { name, role: char.role, voiceSuffix: char.voice ? `（口調: ${char.voice}）` : '' };
    });
  }

  const castingRules = soulText.promptConfig?.agents?.character_developer?.casting_rules;
  if (castingRules) {
    ctx.castingRules = castingRules.map(r => ({ text: r }));
  }

  ctx.themeInfo = {
    emotion: theme.emotion,
    timeline: theme.timeline,
    premise: theme.premise,
    tone: theme.tone,
    narrative_type: theme.narrative_type || '',
  };

  ctx.themeCharacters = theme.characters.map(c => ({
    name: c.name,
    isNew: c.isNew,
    tag: c.isNew ? '（新規）' : '（既存）',
    descSuffix: c.description ? `: ${c.description}` : '',
  }));

  if (charMacGuffins && charMacGuffins.length > 0) {
    ctx.characterMacGuffins = charMacGuffins.map(m => ({
      name: m.characterName,
      secret: m.secret,
      surfaceSigns: m.surfaceSigns.join('、'),
    }));
  }

  return ctx;
}

function charDevFallback(theme: GeneratedTheme): DevelopedCharacters {
  return {
    characters: theme.characters.map(c => ({
      name: c.name,
      isNew: c.isNew,
      role: c.description || '',
      description: c.description || '',
      voice: '',
    })),
    castingRationale: 'Fallback: テーマ生成時のキャラクターをそのまま使用',
  };
}

// --- Factory function ---

export function createCharacterDeveloper(llmClient: LLMClient, soulText: SoulText): CharacterDeveloperFn {
  return {
    develop: async (theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Promise<CharacterDevelopResult> => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildCharDevContext(soulText, theme, charMacGuffins);
      const { system: systemPrompt, user: userPrompt } = buildPrompt('character-developer', context);

      let developed: DevelopedCharacters;
      try {
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          LLMCharacterResponseSchema,
          { temperature: 1.0 },
        );

        if (response.data.characters.length === 0) {
          developed = charDevFallback(theme);
        } else {
          developed = {
            characters: response.data.characters,
            castingRationale: response.data.castingRationale,
          };
        }
      } catch (e) {
        console.warn('[character-developer] completeStructured failed, using fallback:', e instanceof Error ? e.message : e);
        developed = charDevFallback(theme);
      }

      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { developed, tokensUsed };
    },
  };
}

