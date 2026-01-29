import { z } from 'zod';

/**
 * Schema for a character in a generated theme
 */
export const CharacterSchema = z.object({
  /** Character name */
  name: z.string().min(1),
  /** Whether this is a newly generated character */
  isNew: z.boolean(),
  /** Description for new characters */
  description: z.string().optional(),
});

/**
 * Schema for a generated theme
 */
export const GeneratedThemeSchema = z.object({
  /** Emotional theme (e.g., "孤独", "渇望") */
  emotion: z.string().min(1),
  /** Timeline position (e.g., "出会い前", "出会い後") */
  timeline: z.string().min(1),
  /** Characters involved in the story */
  characters: z.array(CharacterSchema).min(1),
  /** Story premise (1-2 sentences) */
  premise: z.string().min(1),
  /** Scene types to include in the story */
  scene_types: z.array(z.string().min(1)).min(1),
});

export type Character = z.infer<typeof CharacterSchema>;
export type GeneratedTheme = z.infer<typeof GeneratedThemeSchema>;
