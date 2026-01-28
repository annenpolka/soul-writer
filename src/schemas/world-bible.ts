import { z } from 'zod';

// Technology definitions - flexible schema
export const TechnologyItemSchema = z.record(z.string(), z.unknown());

export const TechnologySchema = z.record(z.string(), TechnologyItemSchema);

// Society aspects
export const SocietyAspectSchema = z.object({
  state: z.string(),
  implications: z.array(z.string()),
});

export const SocietySchema = z.record(z.string(), SocietyAspectSchema);

// Character definitions - flexible schema with required role field
export const CharacterSchema = z
  .object({
    role: z.string(),
  })
  .catchall(z.unknown());

export const CharactersSchema = z.record(z.string(), CharacterSchema);

// Terminology
export const TerminologySchema = z.record(z.string(), z.string());

// Locations
export const LocationSchema = z.object({
  description: z.string(),
  alias: z.string().optional(),
  significance: z.string(),
});

export const LocationsSchema = z.record(z.string(), LocationSchema);

// Full World Bible schema
export const WorldBibleSchema = z.object({
  technology: TechnologySchema,
  society: SocietySchema,
  characters: CharactersSchema,
  terminology: TerminologySchema,
  locations: LocationsSchema,
});

export type Technology = z.infer<typeof TechnologySchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type WorldBible = z.infer<typeof WorldBibleSchema>;
