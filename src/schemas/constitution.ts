import { z } from 'zod';

// Meta information
export const MetaSchema = z.object({
  soul_id: z.string(),
  soul_name: z.string(),
  version: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Sentence structure rules (protagonist-specific)
export const TaigendomeSchema = z.object({
  usage: z.string(),
  frequency: z.string().optional(),
  forbidden_context: z.array(z.string()),
});

export const TypicalLengthsSchema = z.object({
  short: z.string(),
  long: z.string(),
  forbidden: z.string(),
});

export const SentenceStructureSchema = z.object({
  rhythm_pattern: z.string().optional(),
  taigendome: TaigendomeSchema,
  typical_lengths: TypicalLengthsSchema.optional(),
});

// Vocabulary rules (universal)
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

// Rhetoric rules (universal)
export const RhetoricSchema = z.object({
  simile_base: z.string(),
  metaphor_density: z.enum(['low', 'medium', 'high']),
  forbidden_similes: z.array(z.string()),
  personification_allowed_for: z.array(z.string()),
});

// Narrative rules (protagonist-specific)
export const NarrativeSchema = z.object({
  default_pov: z.string(),
  pov_by_character: z.record(z.string(), z.string()),
  default_tense: z.string(),
  tense_shift_allowed: z.string(),
  dialogue_ratio: z.string().optional(),
  dialogue_style_by_character: z.record(z.string(), z.string()),
  quotation_rule: z.string().optional(),
});

// Thematic constraints (universal)
export const ThematicConstraintsSchema = z.object({
  must_preserve: z.array(z.string()),
  forbidden_resolutions: z.array(z.string()),
});

// Scene modes (protagonist-specific, new)
export const SceneModeSchema = z.object({
  description: z.string(),
  style: z.string(),
  examples: z.array(z.string()).optional(),
});

export const SceneModesSchema = z.object({
  mundane: SceneModeSchema,
  tension: SceneModeSchema,
});

// Dry humor (protagonist-specific, new)
export const DryHumorSchema = z.object({
  description: z.string(),
  techniques: z.array(z.string()),
  frequency: z.string(),
});

// New character guide (universal)
export const NewCharacterGuideSchema = z.object({
  description: z.string(),
  rules: z.array(z.string()),
});

// Universal rules (apply to all protagonists)
export const UniversalSchema = z.object({
  vocabulary: VocabularySchema,
  rhetoric: RhetoricSchema,
  thematic_constraints: ThematicConstraintsSchema,
  new_character_guide: NewCharacterGuideSchema,
});

// Protagonist-specific rules (apply only to default protagonist)
export const ProtagonistSpecificSchema = z.object({
  sentence_structure: SentenceStructureSchema,
  narrative: NarrativeSchema,
  scene_modes: SceneModesSchema,
  dry_humor: DryHumorSchema,
});

// Full Constitution schema
export const ConstitutionSchema = z.object({
  meta: MetaSchema,
  universal: UniversalSchema,
  protagonist_specific: ProtagonistSpecificSchema,
});

export type Meta = z.infer<typeof MetaSchema>;
export type Constitution = z.infer<typeof ConstitutionSchema>;
