import type { ToolCallResponse } from '../../llm/types.js';
import type { DevelopedCharacter } from '../../factory/character-developer.js';
import type { EnrichedCharacterPhase1, EnrichedCharacter, CharacterEnrichPhase1Result, CharacterEnrichPhase2Result, PersonalityDynamics } from '../../factory/character-enricher.js';
import { parseToolArguments } from '../../llm/tooling.js';

const VALID_STANCE_TYPES = new Set(['direct', 'oblique', 'indifferent', 'hostile']);

const DEFAULT_DYNAMICS: PersonalityDynamics = {
  innerWound: '過去の喪失による心理的亀裂',
  craving: '他者からの真の承認への渇望',
  surfaceContradiction: '表層の平穏と内面の渇望の乖離',
  distortedFulfillment: '間接的な方法で他者の注意を引こうとする',
  fulfillmentCondition: '自分の存在が他者に認識された瞬間',
  relationshipAsymmetry: '一方的に観察する立場に固執する',
};

interface RawDynamics {
  innerWound?: string;
  craving?: string;
  surfaceContradiction?: string;
  distortedFulfillment?: string;
  fulfillmentCondition?: string;
  relationshipAsymmetry?: string;
}

interface RawPhase1Character {
  name?: string;
  physicalHabits?: Array<{ habit?: string; trigger?: string; sensoryDetail?: string }>;
  stance?: { type?: string; manifestation?: string; blindSpot?: string };
  dynamics?: RawDynamics;
}

interface RawPhase2Character {
  name?: string;
  dialogueSamples?: Array<{ line?: string; situation?: string; voiceNote?: string }>;
}

function createDefaultPhase1(dev: DevelopedCharacter): EnrichedCharacterPhase1 {
  return {
    ...dev,
    physicalHabits: [
      { habit: '手を組む', trigger: '考え事をするとき', sensoryDetail: '指が絡み合う' },
    ],
    stance: { type: 'direct', manifestation: 'テーマに正面から向き合う', blindSpot: '自分自身の矛盾' },
    dynamics: { ...DEFAULT_DYNAMICS },
  };
}

function createDefaultDialogueSamples(dev: { name: string; voice: string }) {
  return [
    { line: '……そうですか', situation: '相手の話を聞いて', voiceNote: `${dev.name}の基本的な相槌` },
    { line: 'まあ、いいんじゃないですか', situation: '曖昧な状況で', voiceNote: `${dev.name}の回避的な返答` },
  ];
}

/**
 * Parse Phase1 LLM response (habits + stance) into EnrichedCharacterPhase1[].
 */
export function parsePhase1Response(
  response: ToolCallResponse,
  originalCharacters: DevelopedCharacter[],
): CharacterEnrichPhase1Result {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_character_enrichment');
  } catch {
    return {
      characters: originalCharacters.map(createDefaultPhase1),
      tokensUsed: response.tokensUsed,
    };
  }

  try {
    const candidate = parsed as { characters?: RawPhase1Character[] };
    const rawChars = Array.isArray(candidate.characters) ? candidate.characters : [];

    const charMap = new Map<string, RawPhase1Character>();
    for (const rc of rawChars) {
      if (rc.name) charMap.set(rc.name, rc);
    }

    const characters: EnrichedCharacterPhase1[] = originalCharacters.map((dev) => {
      const enriched = charMap.get(dev.name);
      if (!enriched) return createDefaultPhase1(dev);

      const habits = Array.isArray(enriched.physicalHabits)
        ? enriched.physicalHabits
            .filter((h) => h.habit && h.trigger && h.sensoryDetail)
            .map((h) => ({
              habit: h.habit!,
              trigger: h.trigger!,
              sensoryDetail: h.sensoryDetail!,
            }))
        : [];

      const stanceType =
        enriched.stance?.type && VALID_STANCE_TYPES.has(enriched.stance.type)
          ? (enriched.stance.type as 'direct' | 'oblique' | 'indifferent' | 'hostile')
          : 'direct';

      const stance = {
        type: stanceType,
        manifestation: enriched.stance?.manifestation || 'テーマに正面から向き合う',
        blindSpot: enriched.stance?.blindSpot || '自分自身の矛盾',
      };

      const rawDyn = enriched.dynamics;
      const dynamics: PersonalityDynamics = {
        innerWound: rawDyn?.innerWound && rawDyn.innerWound.length >= 10 ? rawDyn.innerWound : DEFAULT_DYNAMICS.innerWound,
        craving: rawDyn?.craving && rawDyn.craving.length >= 10 ? rawDyn.craving : DEFAULT_DYNAMICS.craving,
        surfaceContradiction: rawDyn?.surfaceContradiction && rawDyn.surfaceContradiction.length >= 10 ? rawDyn.surfaceContradiction : DEFAULT_DYNAMICS.surfaceContradiction,
        distortedFulfillment: rawDyn?.distortedFulfillment && rawDyn.distortedFulfillment.length >= 10 ? rawDyn.distortedFulfillment : DEFAULT_DYNAMICS.distortedFulfillment,
        fulfillmentCondition: rawDyn?.fulfillmentCondition && rawDyn.fulfillmentCondition.length >= 10 ? rawDyn.fulfillmentCondition : DEFAULT_DYNAMICS.fulfillmentCondition,
        relationshipAsymmetry: rawDyn?.relationshipAsymmetry && rawDyn.relationshipAsymmetry.length >= 10 ? rawDyn.relationshipAsymmetry : DEFAULT_DYNAMICS.relationshipAsymmetry,
      };

      return {
        ...dev,
        physicalHabits: habits.length > 0
          ? habits.slice(0, 3)
          : [{ habit: '手を組む', trigger: '考え事をするとき', sensoryDetail: '指が絡み合う' }],
        stance,
        dynamics,
      };
    });

    return { characters, tokensUsed: response.tokensUsed };
  } catch {
    return {
      characters: originalCharacters.map(createDefaultPhase1),
      tokensUsed: response.tokensUsed,
    };
  }
}

/**
 * Parse Phase2 LLM response (dialogue samples) into EnrichedCharacter[].
 */
export function parsePhase2Response(
  response: ToolCallResponse,
  phase1Characters: EnrichedCharacterPhase1[],
): CharacterEnrichPhase2Result {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_dialogue_samples');
  } catch {
    return {
      characters: phase1Characters.map((c) => ({
        ...c,
        dialogueSamples: createDefaultDialogueSamples(c),
      })),
      tokensUsed: response.tokensUsed,
    };
  }

  try {
    const candidate = parsed as { characters?: RawPhase2Character[] };
    const rawChars = Array.isArray(candidate.characters) ? candidate.characters : [];

    const charMap = new Map<string, RawPhase2Character>();
    for (const rc of rawChars) {
      if (rc.name) charMap.set(rc.name, rc);
    }

    const characters: EnrichedCharacter[] = phase1Characters.map((p1) => {
      const enriched = charMap.get(p1.name);
      if (!enriched) {
        return { ...p1, dialogueSamples: createDefaultDialogueSamples(p1) };
      }

      const samples = Array.isArray(enriched.dialogueSamples)
        ? enriched.dialogueSamples
            .filter((s) => s.line && s.situation && s.voiceNote)
            .map((s) => ({
              line: s.line!,
              situation: s.situation!,
              voiceNote: s.voiceNote!,
            }))
        : [];

      return {
        ...p1,
        dialogueSamples: samples.length >= 2
          ? samples.slice(0, 5)
          : createDefaultDialogueSamples(p1),
      };
    });

    return { characters, tokensUsed: response.tokensUsed };
  } catch {
    return {
      characters: phase1Characters.map((c) => ({
        ...c,
        dialogueSamples: createDefaultDialogueSamples(c),
      })),
      tokensUsed: response.tokensUsed,
    };
  }
}
