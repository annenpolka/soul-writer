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
