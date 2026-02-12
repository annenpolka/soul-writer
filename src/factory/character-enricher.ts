import { z } from 'zod';
import type { LLMClient, ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import type { Plot } from '../schemas/plot.js';
import type { CharacterMacGuffin } from '../schemas/macguffin.js';
import type { DevelopedCharacter } from './character-developer.js';
import { buildPhase1Context, buildPhase2Context } from '../agents/context/character-enricher-context.js';
import { parsePhase1Response, parsePhase2Response } from '../agents/parsers/character-enricher-parser.js';
import { buildPrompt } from '../template/composer.js';

// =====================
// Zod Schemas
// =====================

export const PhysicalHabitSchema = z.object({
  habit: z.string().min(1),
  trigger: z.string().min(1),
  sensoryDetail: z.string().min(1),
});

export const StanceSchema = z.object({
  type: z.enum(['direct', 'oblique', 'indifferent', 'hostile']),
  manifestation: z.string().min(1),
  blindSpot: z.string().min(1),
});

export const PersonalityDynamicsSchema = z.object({
  innerWound: z.string().min(10),
  craving: z.string().min(10),
  surfaceContradiction: z.string().min(10),
  distortedFulfillment: z.string().min(10),
  fulfillmentCondition: z.string().min(10),
  relationshipAsymmetry: z.string().min(10),
});

export const DialogueSampleSchema = z.object({
  line: z.string().min(1),
  situation: z.string().min(1),
  voiceNote: z.string().min(1),
});

export const EnrichedCharacterPhase1Schema = z.object({
  name: z.string(),
  isNew: z.boolean(),
  role: z.string(),
  description: z.string(),
  voice: z.string(),
  physicalHabits: z.array(PhysicalHabitSchema).min(1).max(3),
  stance: StanceSchema,
  dynamics: PersonalityDynamicsSchema,
});

export const EnrichedCharacterSchema = EnrichedCharacterPhase1Schema.extend({
  dialogueSamples: z.array(DialogueSampleSchema).min(2).max(5),
});

// =====================
// Type Exports
// =====================

export type PhysicalHabit = z.infer<typeof PhysicalHabitSchema>;
export type Stance = z.infer<typeof StanceSchema>;
export type PersonalityDynamics = z.infer<typeof PersonalityDynamicsSchema>;
export type DialogueSample = z.infer<typeof DialogueSampleSchema>;
export type EnrichedCharacterPhase1 = z.infer<typeof EnrichedCharacterPhase1Schema>;
export type EnrichedCharacter = z.infer<typeof EnrichedCharacterSchema>;

// =====================
// Result Types
// =====================

export interface CharacterEnrichPhase1Result {
  characters: EnrichedCharacterPhase1[];
  tokensUsed: number;
}

export interface CharacterEnrichPhase2Result {
  characters: EnrichedCharacter[];
  tokensUsed: number;
}

// =====================
// Agent Interface
// =====================

export interface CharacterEnricherFn {
  enrichPhase1: (
    characters: DevelopedCharacter[],
    theme: GeneratedTheme,
    macGuffins?: CharacterMacGuffin[],
  ) => Promise<CharacterEnrichPhase1Result>;

  enrichPhase2: (
    characters: EnrichedCharacterPhase1[],
    plot: Plot,
    theme: GeneratedTheme,
  ) => Promise<CharacterEnrichPhase2Result>;
}

// =====================
// Tool Definitions
// =====================

const SUBMIT_CHARACTER_ENRICHMENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_character_enrichment',
    description: 'キャラクターの人格力学・身体の癖・テーマへの態度を提出する',
    parameters: {
      type: 'object',
      properties: {
        characters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              physicalHabits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    habit: { type: 'string' },
                    trigger: { type: 'string' },
                    sensoryDetail: { type: 'string' },
                  },
                  required: ['habit', 'trigger', 'sensoryDetail'],
                  additionalProperties: false,
                },
              },
              stance: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['direct', 'oblique', 'indifferent', 'hostile'] },
                  manifestation: { type: 'string' },
                  blindSpot: { type: 'string' },
                },
                required: ['type', 'manifestation', 'blindSpot'],
                additionalProperties: false,
              },
              dynamics: {
                type: 'object',
                properties: {
                  innerWound: { type: 'string' },
                  craving: { type: 'string' },
                  surfaceContradiction: { type: 'string' },
                  distortedFulfillment: { type: 'string' },
                  fulfillmentCondition: { type: 'string' },
                  relationshipAsymmetry: { type: 'string' },
                },
                required: ['innerWound', 'craving', 'surfaceContradiction', 'distortedFulfillment', 'fulfillmentCondition', 'relationshipAsymmetry'],
                additionalProperties: false,
              },
            },
            required: ['name', 'physicalHabits', 'stance', 'dynamics'],
            additionalProperties: false,
          },
        },
      },
      required: ['characters'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const SUBMIT_DIALOGUE_SAMPLES_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_dialogue_samples',
    description: 'キャラクターの台詞サンプルを提出する',
    parameters: {
      type: 'object',
      properties: {
        characters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              dialogueSamples: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    line: { type: 'string' },
                    situation: { type: 'string' },
                    voiceNote: { type: 'string' },
                  },
                  required: ['line', 'situation', 'voiceNote'],
                  additionalProperties: false,
                },
              },
            },
            required: ['name', 'dialogueSamples'],
            additionalProperties: false,
          },
        },
      },
      required: ['characters'],
      additionalProperties: false,
    },
    strict: true,
  },
};

// =====================
// Factory Function
// =====================

export function createCharacterEnricher(
  llmClient: LLMClient,
  soulText: SoulText,
): CharacterEnricherFn {
  return {
    enrichPhase1: async (characters, theme, macGuffins) => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildPhase1Context({ soulText, characters, theme, macGuffins });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('character-enricher-phase1', context);

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_CHARACTER_ENRICHMENT_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_character_enrichment' } },
          temperature: 0.8,
        },
      );

      const result = parsePhase1Response(response, characters);
      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { characters: result.characters, tokensUsed };
    },

    enrichPhase2: async (characters, plot, theme) => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildPhase2Context({ soulText, characters, plot, theme });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('character-enricher-phase2', context);

      assertToolCallingClient(llmClient);
      const response = await llmClient.completeWithTools(
        systemPrompt,
        userPrompt,
        [SUBMIT_DIALOGUE_SAMPLES_TOOL],
        {
          toolChoice: { type: 'function', function: { name: 'submit_dialogue_samples' } },
          temperature: 0.8,
        },
      );

      const result = parsePhase2Response(response, characters);
      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { characters: result.characters, tokensUsed };
    },
  };
}
