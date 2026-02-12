import { z } from 'zod';
import type { LLMClient, LLMMessage } from '../llm/types.js';
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
  /** LLM reasoning from Phase1 — propagated to Phase2 for multi-turn context */
  reasoning: string | null;
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
    phase1Reasoning?: string | null,
  ) => Promise<CharacterEnrichPhase2Result>;
}

// =====================
// Structured Output Schemas
// =====================

const Phase1ResponseSchema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    physicalHabits: z.array(z.object({
      habit: z.string(),
      trigger: z.string(),
      sensoryDetail: z.string(),
    })),
    stance: z.object({
      type: z.string(),
      manifestation: z.string(),
      blindSpot: z.string(),
    }),
    dynamics: z.object({
      innerWound: z.string(),
      craving: z.string(),
      surfaceContradiction: z.string(),
      distortedFulfillment: z.string(),
      fulfillmentCondition: z.string(),
      relationshipAsymmetry: z.string(),
    }),
  })),
});

const Phase2ResponseSchema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    dialogueSamples: z.array(z.object({
      line: z.string(),
      situation: z.string(),
      voiceNote: z.string(),
    })),
  })),
});

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

      const response = await llmClient.completeStructured!(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        Phase1ResponseSchema,
        { temperature: 1.0 },
      );

      const result = parsePhase1Response(response.data, characters);
      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { characters: result.characters, tokensUsed, reasoning: response.reasoning ?? null };
    },

    enrichPhase2: async (characters, plot, theme, phase1Reasoning?) => {
      const tokensBefore = llmClient.getTotalTokens();

      const context = buildPhase2Context({ soulText, characters, plot, theme });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('character-enricher-phase2', context);

      // Build messages with optional Phase1 reasoning as prior context
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (phase1Reasoning) {
        messages.push(
          {
            role: 'user',
            content: 'Phase1ではキャラクターの身体癖・態度・人格力学を生成しました。以下がその分析過程です。',
          },
          {
            role: 'assistant',
            content: 'Phase1の分析を完了しました。',
            reasoning: phase1Reasoning,
          },
        );
      }

      messages.push({ role: 'user', content: userPrompt });

      const response = await llmClient.completeStructured!(
        messages,
        Phase2ResponseSchema,
        { temperature: 1.0 },
      );

      const result = parsePhase2Response(response.data, characters);
      const tokensUsed = llmClient.getTotalTokens() - tokensBefore;

      return { characters: result.characters, tokensUsed };
    },
  };
}
