import { z } from 'zod';
import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { CharacterMacGuffinSchema, type CharacterMacGuffin } from '../schemas/macguffin.js';
import { buildPrompt } from '../template/composer.js';

const CharacterMacGuffinResponseSchema = z.object({
  characterMacGuffins: z.array(CharacterMacGuffinSchema),
});

export interface CharacterMacGuffinResult {
  macguffins: CharacterMacGuffin[];
  tokensUsed: number;
}

// --- FP interface ---

export interface CharacterMacGuffinFn {
  generate: (theme: GeneratedTheme) => Promise<CharacterMacGuffinResult>;
}

// --- Internal helpers ---

function buildCharMacGuffinContext(soulText: SoulText, theme: GeneratedTheme): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};

  const characters = soulText.worldBible.characters;
  if (Object.keys(characters).length > 0) {
    ctx.existingCharacters = Object.entries(characters).map(([name, char]) => ({
      name,
      role: char.role,
      description: char.description || '',
    }));
  }

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
    tone: theme.tone,
  };

  const tech = soulText.worldBible.technology;
  if (Object.keys(tech).length > 0) {
    ctx.technologyEntries = Object.entries(tech).map(
      ([name, desc]) => ({ name, description: String(desc) }),
    );
  }

  return ctx;
}

function charMacGuffinFallback(theme: GeneratedTheme): CharacterMacGuffin[] {
  return theme.characters.map(c => ({
    characterName: c.name,
    secret: '不明な過去を持つ',
    surfaceSigns: ['時折見せる不自然な沈黙'],
    narrativeFunction: '物語に不透明さを加える',
  }));
}

// --- Factory function ---

export function createCharacterMacGuffinAgent(llmClient: LLMClient, soulText: SoulText): CharacterMacGuffinFn {
  return {
    generate: async (theme: GeneratedTheme): Promise<CharacterMacGuffinResult> => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildCharMacGuffinContext(soulText, theme);
      const { system: systemPrompt, user: userPrompt } = buildPrompt('character-macguffin', context);

      let macguffins: CharacterMacGuffin[];
      try {
        const response = await llmClient.completeStructured!(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          CharacterMacGuffinResponseSchema,
          { temperature: 1.0 },
        );

        macguffins = response.data.characterMacGuffins.length > 0
          ? response.data.characterMacGuffins
          : charMacGuffinFallback(theme);
      } catch (e) {
        console.warn('[character-macguffin] completeStructured failed, using fallback:', e instanceof Error ? e.message : e);
        macguffins = charMacGuffinFallback(theme);
      }

      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { macguffins, tokensUsed };
    },
  };
}

