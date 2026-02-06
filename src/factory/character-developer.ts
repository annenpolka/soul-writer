import { z } from 'zod';
import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import type { CharacterMacGuffin } from '../schemas/macguffin.js';
import { buildPrompt } from '../template/composer.js';

const SUBMIT_CHARACTERS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_characters',
    description: 'キャラクターの詳細設定を提出する',
    parameters: {
      type: 'object',
      properties: {
        characters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              isNew: { type: 'boolean' },
              role: { type: 'string' },
              description: { type: 'string' },
              voice: { type: 'string' },
            },
            required: ['name', 'isNew', 'role'],
            additionalProperties: false,
          },
        },
        castingRationale: { type: 'string' },
      },
      required: ['characters', 'castingRationale'],
      additionalProperties: false,
    },
    strict: true,
  },
};

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

function parseCharDevToolResponse(response: ToolCallResponse, theme: GeneratedTheme): DevelopedCharacters {
  let raw: unknown;
  try {
    raw = parseToolArguments<unknown>(response, 'submit_characters');
  } catch {
    return charDevFallback(theme);
  }

  const result = LLMCharacterResponseSchema.safeParse(raw);
  if (!result.success || result.data.characters.length === 0) {
    return charDevFallback(theme);
  }
  return {
    characters: result.data.characters,
    castingRationale: result.data.castingRationale,
  };
}

// --- Factory function ---

export function createCharacterDeveloper(llmClient: LLMClient, soulText: SoulText): CharacterDeveloperFn {
  return {
    develop: async (theme: GeneratedTheme, charMacGuffins?: CharacterMacGuffin[]): Promise<CharacterDevelopResult> => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildCharDevContext(soulText, theme, charMacGuffins);
      const { system: systemPrompt, user: userPrompt } = buildPrompt('character-developer', context);
      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_CHARACTERS_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_characters' } },
          temperature: 0.8,
        },
      );

      const developed = parseCharDevToolResponse(response, theme);
      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { developed, tokensUsed };
    },
  };
}

