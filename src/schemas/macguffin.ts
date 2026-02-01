import { z } from 'zod';

/**
 * A hidden element attached to a character — secret, concealed motive, or buried past
 */
export const CharacterMacGuffinSchema = z.object({
  characterName: z.string().min(1),
  secret: z.string().min(1),
  surfaceSigns: z.array(z.string().min(1)).min(1),
  narrativeFunction: z.string().min(1),
});

/**
 * A mysterious plot element — unexplained phenomenon, hidden mechanism, or enigmatic object
 */
export const PlotMacGuffinSchema = z.object({
  name: z.string().min(1),
  surfaceAppearance: z.string().min(1),
  hiddenLayer: z.string().min(1),
  tensionQuestions: z.array(z.string().min(1)).min(1),
  presenceHint: z.string().min(1),
});

export type CharacterMacGuffin = z.infer<typeof CharacterMacGuffinSchema>;
export type PlotMacGuffin = z.infer<typeof PlotMacGuffinSchema>;
