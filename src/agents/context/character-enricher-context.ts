import type { SoulText } from '../../soul/manager.js';
import type { DevelopedCharacter } from '../../factory/character-developer.js';
import type { EnrichedCharacterPhase1 } from '../../factory/character-enricher.js';
import type { GeneratedTheme } from '../../schemas/generated-theme.js';
import type { CharacterMacGuffin } from '../../schemas/macguffin.js';
import type { Plot } from '../../schemas/plot.js';

export interface Phase1ContextInput {
  soulText: SoulText;
  characters: DevelopedCharacter[];
  theme: GeneratedTheme;
  macGuffins?: CharacterMacGuffin[];
}

export interface Phase2ContextInput {
  soulText: SoulText;
  characters: EnrichedCharacterPhase1[];
  plot: Plot;
  theme: GeneratedTheme;
}

/**
 * Build template context for Phase1 (physical habits + stance).
 * Pure function — no side effects.
 */
export function buildPhase1Context(input: Phase1ContextInput): Record<string, unknown> {
  const { soulText, characters, theme, macGuffins } = input;

  const characterList = characters.map((c) => ({
    name: c.name,
    isNew: c.isNew,
    role: c.role,
    description: c.description,
    voice: c.voice,
  }));

  // Reference character voices from world bible for quality anchor
  const referenceVoices: Array<{ name: string; voice: string }> = [];
  for (const [name, char] of Object.entries(soulText.worldBible.characters)) {
    if (char.voice) {
      referenceVoices.push({ name, voice: char.voice });
    }
  }

  // Reference fragments (character_voice category) for quality anchor
  const voiceFragments: Array<{ text: string }> = [];
  const charVoiceFrags = soulText.fragments.get('character_voice');
  if (charVoiceFrags) {
    for (const frag of charVoiceFrags.slice(0, 3)) {
      voiceFragments.push({ text: frag.text });
    }
  }

  // MacGuffin data for dynamics generation constraint
  const characterMacGuffins = macGuffins
    ? macGuffins.map((m) => ({
        characterName: m.characterName,
        secret: m.secret,
        surfaceSigns: m.surfaceSigns,
      }))
    : [];

  return {
    characters: characterList,
    themeEmotion: theme.emotion,
    themePremise: theme.premise,
    themeTone: theme.tone || '',
    referenceVoices,
    voiceFragments,
    characterMacGuffins,
  };
}

/**
 * Build template context for Phase2 (dialogue samples).
 * Pure function — no side effects.
 */
export function buildPhase2Context(input: Phase2ContextInput): Record<string, unknown> {
  const { soulText, characters, plot, theme } = input;

  const characterList = characters.map((c) => ({
    name: c.name,
    role: c.role,
    voice: c.voice,
    description: c.description,
    stanceType: c.stance.type,
    stanceManifestation: c.stance.manifestation,
    stanceBlindSpot: c.stance.blindSpot,
    habits: c.physicalHabits.map((h) => h.habit).join('、'),
    craving: c.dynamics.craving,
    distortedFulfillment: c.dynamics.distortedFulfillment,
  }));

  // Plot summary for dialogue context
  const plotSummary = plot.chapters
    .map((ch) => `${ch.title}: ${ch.summary}`)
    .join('\n');

  // Reference dialogue fragments for quality anchor
  const dialogueFragments: Array<{ text: string }> = [];
  const dialogFrags = soulText.fragments.get('dialogue');
  if (dialogFrags) {
    for (const frag of dialogFrags.slice(0, 5)) {
      dialogueFragments.push({ text: frag.text });
    }
  }

  return {
    characters: characterList,
    themeEmotion: theme.emotion,
    themePremise: theme.premise,
    plotSummary,
    dialogueFragments,
  };
}
