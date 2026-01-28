import { z } from 'zod';

// Meta information
export const MetaSchema = z.object({
  soul_id: z.string(),
  soul_name: z.string(),
  version: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Sentence structure rules
export const TaigendomeSchema = z.object({
  usage: z.string(),
  frequency: z.string(),
  forbidden_context: z.array(z.string()),
});

export const TypicalLengthsSchema = z.object({
  short: z.string(),
  long: z.string(),
  forbidden: z.string(),
});

export const SentenceStructureSchema = z.object({
  rhythm_pattern: z.string(),
  taigendome: TaigendomeSchema,
  typical_lengths: TypicalLengthsSchema,
});

// Vocabulary rules
export const BracketNotationSchema = z.object({
  kanji: z.string(),
  ruby: z.string(),
  required: z.boolean(),
});

export const SpecialMarksSchema = z.object({
  mark: z.string(),
  usage: z.string(),
  forms: z.array(z.string()),
});

export const VocabularySchema = z.object({
  bracket_notations: z.array(BracketNotationSchema),
  forbidden_words: z.array(z.string()),
  characteristic_expressions: z.array(z.string()),
  special_marks: SpecialMarksSchema,
});

// Rhetoric rules
export const RhetoricSchema = z.object({
  simile_base: z.string(),
  metaphor_density: z.enum(['low', 'medium', 'high']),
  forbidden_similes: z.array(z.string()),
  personification_allowed_for: z.array(z.string()),
});

// Narrative rules
export const NarrativeSchema = z.object({
  default_pov: z.string(),
  pov_by_character: z.record(z.string(), z.string()),
  default_tense: z.string(),
  tense_shift_allowed: z.string(),
  dialogue_ratio: z.string(),
  dialogue_style_by_character: z.record(z.string(), z.string()),
});

// Thematic constraints
export const ThematicConstraintsSchema = z.object({
  must_preserve: z.array(z.string()),
  forbidden_resolutions: z.array(z.string()),
});

// Full Constitution schema
export const ConstitutionSchema = z.object({
  meta: MetaSchema,
  sentence_structure: SentenceStructureSchema,
  vocabulary: VocabularySchema,
  rhetoric: RhetoricSchema,
  narrative: NarrativeSchema,
  thematic_constraints: ThematicConstraintsSchema,
});

export type Meta = z.infer<typeof MetaSchema>;
export type Constitution = z.infer<typeof ConstitutionSchema>;
