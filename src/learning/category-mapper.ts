import type { FragmentCategoryType } from '../schemas/fragments.js';

const CATEGORY_MAP: Record<string, FragmentCategoryType> = {
  opening: 'opening',
  closing: 'opening',
  killing: 'killing',
  introspection: 'introspection',
  dialogue: 'dialogue',
  world_building: 'world_building',
  worldbuilding: 'world_building',
  character_voice: 'character_voice',
  character: 'character_voice',
  symbolism: 'symbolism',
  action: 'action',
  generated_dialogue: 'generated_dialogue',
};

/**
 * Map an extractor-output category to a valid FragmentCategory value.
 * Returns null if the category cannot be mapped.
 */
export function mapExtractorCategory(
  category: string
): FragmentCategoryType | null {
  return CATEGORY_MAP[category.toLowerCase()] ?? null;
}
