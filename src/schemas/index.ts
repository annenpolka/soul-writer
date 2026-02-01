// Constitution (Layer 1)
export {
  ConstitutionSchema,
  MetaSchema,
  SentenceStructureSchema,
  VocabularySchema,
  RhetoricSchema,
  NarrativeSchema,
  ThematicConstraintsSchema,
  type Constitution,
  type Meta,
} from './constitution.js';

// Fragments (Layer 2)
export {
  FragmentSchema,
  FragmentCollectionSchema,
  FragmentCategory,
  type Fragment,
  type FragmentCollection,
  type FragmentCategoryType,
} from './fragments.js';

// World Bible (Layer 3)
export {
  WorldBibleSchema,
  TechnologySchema,
  CharacterSchema,
  CharactersSchema,
  TerminologySchema,
  LocationsSchema,
  type WorldBible,
  type Character,
} from './world-bible.js';

// Anti-Soul (Layer 4)
export {
  AntiSoulSchema,
  AntiSoulEntrySchema,
  AntiSoulCategory,
  type AntiSoul,
  type AntiSoulEntry,
  type AntiSoulCategoryType,
} from './anti-soul.js';

// Reader Personas
export {
  ReaderPersonasSchema,
  ReaderPersonaSchema,
  EvaluationWeightsSchema,
  type ReaderPersonas,
  type ReaderPersona,
  type EvaluationWeights,
} from './reader-personas.js';

// Combined SoulText
export { type SoulText } from './soul-text.js';

// Plot
export {
  PlotSchema,
  ChapterSchema,
  type Plot,
  type Chapter,
} from './plot.js';

// Generated Theme (Factory)
export {
  GeneratedThemeSchema,
  CharacterSchema as GeneratedCharacterSchema,
  type GeneratedTheme,
  type Character as GeneratedCharacter,
} from './generated-theme.js';

// Factory Config
export {
  FactoryConfigSchema,
  DEFAULT_FACTORY_CONFIG,
  type FactoryConfig,
} from './factory-config.js';

// Writer Personas
export {
  WriterPersonasSchema,
  WriterPersonaSchema,
  type WriterPersonas,
  type WriterPersona,
} from './writer-persona.js';

// Prompt Config
export {
  PromptConfigSchema,
  PromptConfigDefaultsSchema,
  PovRulesSchema,
  AgentPromptConfigSchema,
  DEFAULT_PROMPT_CONFIG,
  type PromptConfig,
  type PromptConfigDefaults,
  type PovRules,
  type AgentPromptConfig,
} from './prompt-config.js';
