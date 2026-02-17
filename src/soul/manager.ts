import type {
  Constitution,
  WorldBible,
  AntiSoul,
  ReaderPersonas,
  Fragment,
  PromptConfig,
  WriterPersona,
} from '../schemas/index.js';
import { loadSoulText, type SoulTextLoadResult, type LoadOptions } from './loader.js';

export { loadSoulText } from './loader.js';
export type { LoadOptions } from './loader.js';

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
 * Build a system prompt from soul text data (pure function).
 */
export function buildSystemPrompt(soulText: SoulText, category?: string): string {
  const parts: string[] = [];

  // Header
  parts.push('# ソウルテキスト');
  parts.push('');

  // Constitution - universal
  const u = soulText.constitution.universal;
  const ps = soulText.constitution.protagonist_specific;
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
  for (const [name, char] of Object.entries(soulText.worldBible.characters)) {
    parts.push(`- **${name}**: ${char.role}`);
  }
  parts.push('');
  parts.push('### 用語');
  for (const [term, def] of Object.entries(soulText.worldBible.terminology)) {
    parts.push(`- ${term}: ${def}`);
  }
  parts.push('');

  // Anti-Soul
  parts.push('## 反魂（禁止パターン）');
  parts.push('');
  parts.push('以下のような文章は絶対に書いてはいけない:');
  for (const [cat, entries] of Object.entries(soulText.antiSoul.categories)) {
    parts.push(`### ${cat}`);
    for (const entry of entries.slice(0, 2)) {
      parts.push(`> ${entry.text.slice(0, 100)}...`);
      parts.push(`> 理由: ${entry.reason}`);
    }
  }
  parts.push('');

  // Fragments for specific category
  if (category) {
    const categoryFragments = soulText.fragments.get(category) ?? [];
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

export interface SoulTextManagerFn {
  getConstitution: () => Constitution;
  getWorldBible: () => WorldBible;
  getAntiSoul: () => AntiSoul;
  getReaderPersonas: () => ReaderPersonas;
  getFragmentsForCategory: (category: string) => Fragment[];
  getAllFragments: () => Map<string, Fragment[]>;
  getPromptConfig: () => PromptConfig;
  getWriterPersonas: () => WriterPersona[];
  getCollabPersonas: () => WriterPersona[];
  getRawSoultext: () => string | undefined;
  clearRawSoultext: () => void;
  getSoulText: () => SoulText;
  buildSystemPrompt: (category?: string) => string;
}

export function createSoulTextManager(data: SoulTextLoadResult): SoulTextManagerFn {
  let currentData = data;

  const getSoulTextObj = (): SoulText => ({
    constitution: currentData.constitution,
    worldBible: currentData.worldBible,
    antiSoul: currentData.antiSoul,
    readerPersonas: currentData.readerPersonas,
    writerPersonas: currentData.writerPersonas,
    fragments: new Map(currentData.fragments),
    promptConfig: currentData.promptConfig,
    rawSoultext: currentData.rawSoultext,
  });

  return {
    getConstitution: () => currentData.constitution,
    getWorldBible: () => currentData.worldBible,
    getAntiSoul: () => currentData.antiSoul,
    getReaderPersonas: () => currentData.readerPersonas,
    getFragmentsForCategory: (category) => currentData.fragments.get(category) ?? [],
    getAllFragments: () => new Map(currentData.fragments),
    getPromptConfig: () => currentData.promptConfig,
    getWriterPersonas: () => currentData.writerPersonas,
    getCollabPersonas: () => currentData.collabPersonas,
    getRawSoultext: () => currentData.rawSoultext,
    clearRawSoultext: () => { currentData = { ...currentData, rawSoultext: undefined }; },
    getSoulText: getSoulTextObj,
    buildSystemPrompt: (category?) => buildSystemPrompt(getSoulTextObj(), category),
  };
}

/**
 * Load soul text from a directory and create a manager.
 */
export async function loadSoulTextManager(
  soulDir: string,
  options?: LoadOptions
): Promise<SoulTextManagerFn> {
  const data = await loadSoulText(soulDir, options);
  return createSoulTextManager(data);
}

