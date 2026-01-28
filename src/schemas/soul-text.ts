import { ConstitutionSchema, type Constitution } from './constitution.js';
import { FragmentCollectionSchema, type FragmentCollection } from './fragments.js';
import { WorldBibleSchema, type WorldBible } from './world-bible.js';
import { AntiSoulSchema, type AntiSoul } from './anti-soul.js';
import { ReaderPersonasSchema, type ReaderPersonas } from './reader-personas.js';

// Complete SoulText structure
export interface SoulText {
  constitution: Constitution;
  fragments: Map<string, FragmentCollection>;
  worldBible: WorldBible;
  antiSoul: AntiSoul;
  readerPersonas: ReaderPersonas;
}

// Export all schemas for validation
export {
  ConstitutionSchema,
  FragmentCollectionSchema,
  WorldBibleSchema,
  AntiSoulSchema,
  ReaderPersonasSchema,
};

// Export all types
export type {
  Constitution,
  FragmentCollection,
  WorldBible,
  AntiSoul,
  ReaderPersonas,
};
