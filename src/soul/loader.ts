import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import {
  ConstitutionSchema,
  WorldBibleSchema,
  AntiSoulSchema,
  ReaderPersonasSchema,
  FragmentCollectionSchema,
  PromptConfigSchema,
  WriterPersonasSchema,
  DEFAULT_PROMPT_CONFIG,
  type Fragment,
  type PromptConfig,
  type WriterPersona,
} from '../schemas/index.js';
import type { SoulText } from './manager.js';

export interface SoulTextLoadResult extends SoulText {
  collabPersonas: WriterPersona[];
}

/**
 * Load soul text from a directory (pure I/O function).
 */
export async function loadSoulText(soulDir: string): Promise<SoulTextLoadResult> {
  if (!existsSync(soulDir)) {
    throw new Error(`Soul directory not found: ${soulDir}`);
  }

  // Load constitution
  const constitutionPath = join(soulDir, 'constitution.json');
  const constitutionJson = JSON.parse(readFileSync(constitutionPath, 'utf-8'));
  const constitution = ConstitutionSchema.parse(constitutionJson);

  // Load world bible
  const worldBiblePath = join(soulDir, 'world-bible.json');
  const worldBibleJson = JSON.parse(readFileSync(worldBiblePath, 'utf-8'));
  const worldBible = WorldBibleSchema.parse(worldBibleJson);

  // Load anti-soul
  const antiSoulPath = join(soulDir, 'anti-soul.json');
  const antiSoulJson = JSON.parse(readFileSync(antiSoulPath, 'utf-8'));
  const antiSoul = AntiSoulSchema.parse(antiSoulJson);

  // Load reader personas
  const readerPersonasPath = join(soulDir, 'reader-personas.json');
  const readerPersonasJson = JSON.parse(readFileSync(readerPersonasPath, 'utf-8'));
  const readerPersonas = ReaderPersonasSchema.parse(readerPersonasJson);

  // Load fragments
  const fragments = new Map<string, Fragment[]>();
  const fragmentsDir = join(soulDir, 'fragments');
  if (existsSync(fragmentsDir)) {
    const fragmentFiles = readdirSync(fragmentsDir).filter((f) =>
      f.endsWith('.json')
    );
    for (const file of fragmentFiles) {
      const fragmentPath = join(fragmentsDir, file);
      const fragmentJson = JSON.parse(readFileSync(fragmentPath, 'utf-8'));
      const collection = FragmentCollectionSchema.parse(fragmentJson);
      fragments.set(collection.category, collection.fragments);
    }
  }

  // Load prompt config (optional - uses default if not found)
  let promptConfig: PromptConfig = DEFAULT_PROMPT_CONFIG;
  const promptConfigPath = join(soulDir, 'prompt-config.yaml');
  if (existsSync(promptConfigPath)) {
    const rawYaml = readFileSync(promptConfigPath, 'utf-8');
    const parsed = yaml.load(rawYaml);
    promptConfig = PromptConfigSchema.parse(parsed);
  }

  // Load writer personas (optional)
  let writerPersonas: WriterPersona[] = [];
  const writerPersonasPath = join(soulDir, 'writer-personas.json');
  if (existsSync(writerPersonasPath)) {
    const writerPersonasJson = JSON.parse(readFileSync(writerPersonasPath, 'utf-8'));
    const parsed = WriterPersonasSchema.parse(writerPersonasJson);
    writerPersonas = parsed.personas;
  }

  // Load collaboration personas (optional)
  let collabPersonas: WriterPersona[] = [];
  const collabPersonasPath = join(soulDir, 'collab-personas.json');
  if (existsSync(collabPersonasPath)) {
    const collabPersonasJson = JSON.parse(readFileSync(collabPersonasPath, 'utf-8'));
    const parsedCollab = WriterPersonasSchema.parse(collabPersonasJson);
    collabPersonas = parsedCollab.personas;
  }

  // Load raw soultext (optional)
  let rawSoultext: string | undefined;
  const soultextPath = join(soulDir, 'soultext.md');
  if (existsSync(soultextPath)) {
    rawSoultext = readFileSync(soultextPath, 'utf-8');
  }

  return {
    constitution,
    worldBible,
    antiSoul,
    readerPersonas,
    fragments,
    promptConfig,
    writerPersonas,
    collabPersonas,
    rawSoultext,
  };
}
