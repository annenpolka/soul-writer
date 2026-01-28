import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ConstitutionSchema,
  WorldBibleSchema,
  AntiSoulSchema,
  ReaderPersonasSchema,
  FragmentCollectionSchema,
  type Constitution,
  type WorldBible,
  type AntiSoul,
  type ReaderPersonas,
  type Fragment,
} from '../schemas/index.js';

/**
 * Complete soul text structure
 */
export interface SoulText {
  constitution: Constitution;
  worldBible: WorldBible;
  antiSoul: AntiSoul;
  readerPersonas: ReaderPersonas;
  fragments: Map<string, Fragment[]>;
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

  private constructor(
    constitution: Constitution,
    worldBible: WorldBible,
    antiSoul: AntiSoul,
    readerPersonas: ReaderPersonas,
    fragments: Map<string, Fragment[]>
  ) {
    this.constitution = constitution;
    this.worldBible = worldBible;
    this.antiSoul = antiSoul;
    this.readerPersonas = readerPersonas;
    this.fragments = fragments;
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

    return new SoulTextManager(
      constitution,
      worldBible,
      antiSoul,
      readerPersonas,
      fragments
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

  getSoulText(): SoulText {
    return {
      constitution: this.constitution,
      worldBible: this.worldBible,
      antiSoul: this.antiSoul,
      readerPersonas: this.readerPersonas,
      fragments: new Map(this.fragments),
    };
  }

  /**
   * Build a system prompt containing all soul text components
   */
  buildSystemPrompt(category?: string): string {
    const parts: string[] = [];
    const meta = this.constitution.meta;

    // Header
    parts.push(`# ソウルテキスト: ${meta.soul_name}`);
    parts.push('');

    // Constitution
    parts.push('## 憲法（文体ルール）');
    parts.push('');
    parts.push('### 文構造');
    parts.push(`- リズムパターン: ${this.constitution.sentence_structure.rhythm_pattern}`);
    parts.push(`- 体言止め: ${this.constitution.sentence_structure.taigendome.usage}`);
    parts.push('');
    parts.push('### 語彙');
    parts.push(`- 禁止語彙: ${this.constitution.vocabulary.forbidden_words.join(', ')}`);
    parts.push(`- 特殊記号「${this.constitution.vocabulary.special_marks.mark}」: ${this.constitution.vocabulary.special_marks.usage}`);
    parts.push(`- 使用形態: ${this.constitution.vocabulary.special_marks.forms.join(', ')}`);
    parts.push('');
    parts.push('### 修辞');
    parts.push(`- 比喩の基盤: ${this.constitution.rhetoric.simile_base}`);
    parts.push(`- 禁止比喩: ${this.constitution.rhetoric.forbidden_similes.join(', ')}`);
    parts.push('');
    parts.push('### 語り');
    parts.push(`- 視点: ${this.constitution.narrative.default_pov}`);
    parts.push(`- 時制: ${this.constitution.narrative.default_tense}`);
    parts.push(`- 対話比率: ${this.constitution.narrative.dialogue_ratio}`);
    parts.push('');
    parts.push('### テーマ制約');
    parts.push(`- 維持すべきテーマ: ${this.constitution.thematic_constraints.must_preserve.join(', ')}`);
    parts.push(`- 禁止結末: ${this.constitution.thematic_constraints.forbidden_resolutions.join(', ')}`);
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
