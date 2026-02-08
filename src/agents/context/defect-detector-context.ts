import type { SoulText } from '../../soul/manager.js';

/**
 * Input for buildDefectDetectorContext
 */
export interface DefectDetectorContextInput {
  soulText: SoulText;
  text: string;
}

/**
 * Standard defect categories for detection
 */
const DEFECT_CATEGORIES = [
  { name: 'character_inconsistency', description: 'キャラクターの言動・性格が設定と矛盾' },
  { name: 'plot_contradiction', description: 'プロットの論理的矛盾、因果関係の破綻' },
  { name: 'pacing_issue', description: 'テンポの不均衡、冗長または唐突な展開' },
  { name: 'motif_fatigue', description: 'モチーフ・比喩の過度な繰り返し' },
  { name: 'style_deviation', description: '文体の逸脱、リズム・トーンの不整合' },
  { name: 'worldbuilding_error', description: '世界観設定との矛盾、用語の誤用' },
  { name: 'emotional_flatness', description: '感情表現の平板化、心理描写の浅さ' },
  { name: 'forbidden_pattern', description: '禁止語彙・禁止比喩の使用' },
];

/**
 * Build the full template context for a defect-detector prompt (pure function).
 */
export function buildDefectDetectorContext(input: DefectDetectorContextInput): Record<string, unknown> {
  const { soulText, text } = input;
  const u = soulText.constitution.universal;

  // Constitution rules summary
  const constitutionRules = {
    forbiddenWords: u.vocabulary.forbidden_words,
    forbiddenSimiles: u.rhetoric.forbidden_similes,
    thematicMustPreserve: u.thematic_constraints.must_preserve,
    forbiddenResolutions: u.thematic_constraints.forbidden_resolutions,
  };

  // Anti-soul patterns (max 2 per category)
  const antiSoulPatterns: Array<{ category: string; text: string; reason: string }> = [];
  for (const [category, entries] of Object.entries(soulText.antiSoul.categories)) {
    for (const entry of entries.slice(0, 2)) {
      antiSoulPatterns.push({
        category,
        text: entry.text,
        reason: entry.reason,
      });
    }
  }

  // Character list from world bible
  const characters: Array<{ name: string; role: string }> = [];
  for (const [name, char] of Object.entries(soulText.worldBible.characters)) {
    characters.push({ name, role: char.role });
  }

  return {
    text,
    constitutionRules,
    antiSoulPatterns,
    defectCategories: DEFECT_CATEGORIES,
    characters,
  };
}
