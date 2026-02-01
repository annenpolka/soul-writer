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
  type Constitution,
  type WorldBible,
  type AntiSoul,
  type ReaderPersonas,
  type Fragment,
  type PromptConfig,
  type WriterPersona,
} from '../schemas/index.js';

/**
 * Complete soul text structure
 */
export interface SoulText {
  constitution: Constitution;
  worldBible: WorldBible;
  antiSoul: AntiSoul;
  readerPersonas: ReaderPersonas;
  writerPersonas: WriterPersona[];
  fragments: Map<string, Fragment[]>;
  promptConfig: PromptConfig;
  rawSoultext?: string;
}

/**
 * Manager for loading and accessing soul text components
 */
export class SoulTextManager {
  private constitution: Constitution;
  private worldBible: WorldBible;
  private antiSoul: AntiSoul;
  private readerPersonas: ReaderPersonas;
  private fragments: Map<string, Fragment[]>;
  private promptConfig: PromptConfig;
  private writerPersonas: WriterPersona[];
  private rawSoultext?: string;

  private constructor(
    constitution: Constitution,
    worldBible: WorldBible,
    antiSoul: AntiSoul,
    readerPersonas: ReaderPersonas,
    fragments: Map<string, Fragment[]>,
    promptConfig: PromptConfig,
    writerPersonas: WriterPersona[],
    rawSoultext?: string,
  ) {
    this.constitution = constitution;
    this.worldBible = worldBible;
    this.antiSoul = antiSoul;
    this.readerPersonas = readerPersonas;
    this.fragments = fragments;
    this.promptConfig = promptConfig;
    this.writerPersonas = writerPersonas;
    this.rawSoultext = rawSoultext;
  }

  /**
   * Load soul text from a directory
   */
  static async load(soulDir: string): Promise<SoulTextManager> {
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

    // Load raw soultext (optional)
    let rawSoultext: string | undefined;
    const soultextPath = join(soulDir, 'soultext.md');
    if (existsSync(soultextPath)) {
      rawSoultext = readFileSync(soultextPath, 'utf-8');
    }

    return new SoulTextManager(
      constitution,
      worldBible,
      antiSoul,
      readerPersonas,
      fragments,
      promptConfig,
      writerPersonas,
      rawSoultext,
    );
  }

  getConstitution(): Constitution {
    return this.constitution;
  }

  getWorldBible(): WorldBible {
    return this.worldBible;
  }

  getAntiSoul(): AntiSoul {
    return this.antiSoul;
  }

  getReaderPersonas(): ReaderPersonas {
    return this.readerPersonas;
  }

  getFragmentsForCategory(category: string): Fragment[] {
    return this.fragments.get(category) ?? [];
  }

  getAllFragments(): Map<string, Fragment[]> {
    return new Map(this.fragments);
  }

  getPromptConfig(): PromptConfig {
    return this.promptConfig;
  }

  getWriterPersonas(): WriterPersona[] {
    return this.writerPersonas;
  }

  getRawSoultext(): string | undefined {
    return this.rawSoultext;
  }

  getSoulText(): SoulText {
    return {
      constitution: this.constitution,
      worldBible: this.worldBible,
      antiSoul: this.antiSoul,
      readerPersonas: this.readerPersonas,
      writerPersonas: this.writerPersonas,
      fragments: new Map(this.fragments),
      promptConfig: this.promptConfig,
      rawSoultext: this.rawSoultext,
    };
  }

  /**
   * Build a system prompt containing all soul text components
   */
  buildSystemPrompt(category?: string): string {
    const parts: string[] = [];

    // Header
    parts.push('# ソウルテキスト');
    parts.push('');

    // Constitution - universal
    const u = this.constitution.universal;
    const ps = this.constitution.protagonist_specific;
    parts.push('## 憲法（文体ルール）');
    parts.push('');
    parts.push('### 文構造');
    parts.push(`- リズムパターン: ${ps.sentence_structure.rhythm_pattern}`);
    parts.push(`- 体言止め: ${ps.sentence_structure.taigendome.usage}`);
    parts.push('');
    parts.push('### 語彙');
    parts.push(`- 禁止語彙: ${u.vocabulary.forbidden_words.join(', ')}`);
    parts.push(`- 特殊記号「${u.vocabulary.special_marks.mark}」: ${u.vocabulary.special_marks.usage}`);
    parts.push(`- 使用形態: ${u.vocabulary.special_marks.forms.join(', ')}`);
    parts.push('');
    parts.push('### 修辞');
    parts.push(`- 比喩の基盤: ${u.rhetoric.simile_base}`);
    parts.push(`- 禁止比喩: ${u.rhetoric.forbidden_similes.join(', ')}`);
    parts.push('');
    parts.push('### 語り');
    parts.push(`- 視点: ${ps.narrative.default_pov}`);
    parts.push(`- 時制: ${ps.narrative.default_tense}`);
    parts.push(`- 対話比率: ${ps.narrative.dialogue_ratio}`);
    parts.push('');
    parts.push('### テーマ制約');
    parts.push(`- 維持すべきテーマ: ${u.thematic_constraints.must_preserve.join(', ')}`);
    parts.push(`- 禁止結末: ${u.thematic_constraints.forbidden_resolutions.join(', ')}`);
    parts.push('');

    // World Bible
    parts.push('## 世界聖書（設定）');
    parts.push('');
    parts.push('### キャラクター');
    for (const [name, char] of Object.entries(this.worldBible.characters)) {
      parts.push(`- **${name}**: ${char.role}`);
    }
    parts.push('');
    parts.push('### 用語');
    for (const [term, def] of Object.entries(this.worldBible.terminology)) {
      parts.push(`- ${term}: ${def}`);
    }
    parts.push('');

    // Anti-Soul
    parts.push('## 反魂（禁止パターン）');
    parts.push('');
    parts.push('以下のような文章は絶対に書いてはいけない:');
    for (const [category, entries] of Object.entries(this.antiSoul.categories)) {
      parts.push(`### ${category}`);
      for (const entry of entries.slice(0, 2)) {
        parts.push(`> ${entry.text.slice(0, 100)}...`);
        parts.push(`> 理由: ${entry.reason}`);
      }
    }
    parts.push('');

    // Fragments for specific category
    if (category) {
      const categoryFragments = this.getFragmentsForCategory(category);
      if (categoryFragments.length > 0) {
        parts.push(`## 参考断片（${category}）`);
        parts.push('');
        for (const fragment of categoryFragments.slice(0, 3)) {
          parts.push('```');
          parts.push(fragment.text);
          parts.push('```');
          parts.push('');
        }
      }
    }

    return parts.join('\n');
  }
}
