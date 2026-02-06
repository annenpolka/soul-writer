import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import { CharacterMacGuffinSchema, type CharacterMacGuffin } from '../schemas/macguffin.js';
import { buildPrompt } from '../template/composer.js';

const SUBMIT_CHARACTER_MACGUFFINS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_character_macguffins',
    description: 'キャラクターのマクガフィン（秘密や伏線）を提出する',
    parameters: {
      type: 'object',
      properties: {
        characterMacGuffins: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              characterName: { type: 'string' },
              secret: { type: 'string' },
              surfaceSigns: { type: 'array', items: { type: 'string' } },
              narrativeFunction: { type: 'string' },
            },
            required: ['characterName', 'secret', 'surfaceSigns', 'narrativeFunction'],
            additionalProperties: false,
          },
        },
      },
      required: ['characterMacGuffins'],
      additionalProperties: false,
    },
    strict: true,
  },
};

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

function parseCharMacGuffinToolResponse(response: ToolCallResponse, theme: GeneratedTheme): CharacterMacGuffin[] {
  let raw: unknown;
  try {
    raw = parseToolArguments<unknown>(response, 'submit_character_macguffins');
  } catch (e) {
    console.warn('[character-macguffin] Tool call parsing failed, using fallback:', e instanceof Error ? e.message : e);
    return charMacGuffinFallback(theme);
  }

  const items = Array.isArray(raw) ? raw : (raw as { characterMacGuffins?: unknown }).characterMacGuffins;
  if (!Array.isArray(items)) {
    return charMacGuffinFallback(theme);
  }

  const validated = items.map((item: unknown) => CharacterMacGuffinSchema.safeParse(item))
    .filter((r): r is { success: true; data: CharacterMacGuffin } => r.success)
    .map((r) => r.data);
  return validated.length > 0 ? validated : charMacGuffinFallback(theme);
}

// --- Factory function ---

export function createCharacterMacGuffinAgent(llmClient: LLMClient, soulText: SoulText): CharacterMacGuffinFn {
  return {
    generate: async (theme: GeneratedTheme): Promise<CharacterMacGuffinResult> => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildCharMacGuffinContext(soulText, theme);
      const { system: systemPrompt, user: userPrompt } = buildPrompt('character-macguffin', context);
      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_CHARACTER_MACGUFFINS_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_character_macguffins' } },
          temperature: 0.9,
        },
      );

      const macguffins = parseCharMacGuffinToolResponse(response, theme);
      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { macguffins, tokensUsed };
    },
  };
}

