import type { SoulText } from '../../soul/manager.js';
import type { WriterConfig, ThemeContext, MacGuffinContext } from '../types.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';
import { buildPovRules } from '../../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../../factory/character-developer.js';

/**
 * Input for buildWriterContext — everything a WriterAgent.buildContext() needs
 */
export interface WriterContextInput {
  prompt: string;
  soulText: SoulText;
  config: WriterConfig;
  narrativeRules: NarrativeRules;
  developedCharacters?: DevelopedCharacter[];
  themeContext?: ThemeContext;
  macGuffinContext?: MacGuffinContext;
}

/**
 * Build the full template context for a writer prompt (pure function).
 */
export function buildWriterContext(input: WriterContextInput): Record<string, unknown> {
  const { prompt, soulText, config, narrativeRules, developedCharacters, themeContext, macGuffinContext } = input;
  const ctx: Record<string, unknown> = {};

  ctx.criticalRules = buildCriticalRules(soulText, narrativeRules);
  ctx.constitution = buildConstitutionData(soulText, narrativeRules.isDefaultProtagonist);
  ctx.narrativeRules = narrativeRules;

  // Characters (structured data for include)
  if (developedCharacters && developedCharacters.length > 0) {
    ctx.developedCharacters = developedCharacters.map(c => ({
      ...c,
      displayName: `${c.name}${c.isNew ? '（新規）' : '（既存）'}`,
    }));
  } else {
    ctx.worldBibleCharacters = Object.entries(soulText.worldBible.characters).map(
      ([name, char]) => {
        return { name, role: char.role, traits: char.traits, speech_pattern: char.speech_pattern };
      },
    );
  }

  // Character constraints (structured data for include)
  const constraintEntries = buildCharacterConstraintEntries(soulText, developedCharacters);
  if (constraintEntries.length > 0) {
    ctx.characterConstraintEntries = constraintEntries;
  }

  // Terminology (structured data for include)
  ctx.terminologyEntries = Object.entries(soulText.worldBible.terminology).map(
    ([term, definition]) => ({ term, definition }),
  );

  // Anti-soul (structured data for include)
  ctx.antiSoulEntries = buildAntiSoulEntries(soulText);

  // Fragments (structured data for include)
  ctx.fragmentCategories = buildFragmentCategories(soulText, config);

  // isDefaultProtagonist flag for template conditions
  if (narrativeRules.isDefaultProtagonist) {
    ctx.isDefaultProtagonist = true;
  }

  // Raw soultext (optional)
  if (soulText.rawSoultext) {
    ctx.rawSoultext = soulText.rawSoultext;
  }

  // Persona directive (injected when persona pool is used)
  if (config.personaDirective) {
    ctx.personaDirective = config.personaDirective;
  }

  // Theme context for consistent tone/emotion
  if (themeContext) {
    ctx.themeContext = themeContext;
  }

  // MacGuffin context for character secrets and plot mysteries
  if (macGuffinContext) {
    ctx.macGuffinContext = macGuffinContext;
  }

  ctx.prompt = prompt;

  return ctx;
}

/**
 * Build the critical rules string (pure function).
 */
export function buildCriticalRules(soulText: SoulText, narrativeRules: NarrativeRules): string {
  const parts: string[] = [];
  parts.push('【最重要ルール】');
  for (const rule of buildPovRules(narrativeRules)) {
    parts.push(rule);
  }
  parts.push('- 文体は冷徹・簡潔・乾いた語り。装飾過多や感傷的表現を避ける');
  if (narrativeRules.isDefaultProtagonist) {
    parts.push('- 原作にない設定やキャラクターを捏造しない');
    parts.push('- 「ライオン」は透心固有の内面シンボル。内面の比喩としてのみ使用可。可視的な獣・データ獣としての登場禁止');
  } else {
    parts.push('- この世界観に存在し得る設定・キャラクターを使用すること');
  }
  parts.push('- 参考断片の表現をそのままコピーしない。文体の「質感」を吸収し、独自の描写で新しいシーンを構築すること');
  parts.push('- 参考断片は文体の質感を学ぶためのもの。シーンやプロットを再現してはならない');
  parts.push('- 原作に存在しない新しい描写・比喩・状況を積極的に創作すること');
  const writerConfig = soulText.promptConfig?.agents?.writer;
  if (writerConfig?.critical_rules) {
    for (const rule of writerConfig.critical_rules) {
      parts.push(`- ${rule}`);
    }
  }
  parts.push('- 出力はプレーンテキストの小説本文のみ。マークダウン記法は一切使用禁止');
  parts.push('- 禁止: **太字**, *斜体*, `コード`, # 見出し, - リスト, > 引用ブロック');
  return parts.join('\n');
}

/**
 * Build constitution data for the template (pure function).
 */
export function buildConstitutionData(soulText: SoulText, isDefaultProtagonist: boolean): Record<string, unknown> {
  const c = soulText.constitution;
  const u = c.universal;
  const ps = c.protagonist_specific;

  const result: Record<string, unknown> = {
    // Always include universal
    vocabulary: {
      ...u.vocabulary,
      bracket_notations_required: u.vocabulary.bracket_notations.filter(
        (b: { required: boolean }) => b.required,
      ),
    },
    rhetoric: u.rhetoric,
    thematic_constraints: u.thematic_constraints,
  };

  if (isDefaultProtagonist) {
    // Include protagonist-specific for default protagonist
    result.sentence_structure = ps.sentence_structure;
    result.narrative = {
      ...ps.narrative,
      dialogue_style_entries: Object.entries(ps.narrative.dialogue_style_by_character).map(
        ([name, style]) => ({ name, style }),
      ),
    };
    result.scene_modes = ps.scene_modes;
    result.dry_humor = ps.dry_humor;
  } else {
    // Include new character guide for non-default protagonist
    result.new_character_guide = u.new_character_guide;
  }

  return result;
}

/**
 * Build character constraint entries (pure function).
 */
export function buildCharacterConstraintEntries(
  soulText: SoulText,
  developedCharacters?: DevelopedCharacter[],
): Array<{ name: string; rules: string[] }> {
  const constraints = soulText.promptConfig?.character_constraints;
  if (!constraints) return [];

  const filter = developedCharacters
    ? (charName: string) => developedCharacters.some(c => c.name.includes(charName))
    : undefined;

  const entries = Object.entries(constraints);
  const filtered = filter ? entries.filter(([name]) => filter(name)) : entries;
  return filtered.map(([name, rules]) => ({ name, rules }));
}

/**
 * Build anti-soul entries (pure function).
 */
export function buildAntiSoulEntries(soulText: SoulText): Array<{ category: string; examples: Array<{ text: string; reason: string }> }> {
  const result: Array<{ category: string; examples: Array<{ text: string; reason: string }> }> = [];
  for (const [category, entries] of Object.entries(soulText.antiSoul.categories)) {
    if (entries.length > 0) {
      result.push({
        category,
        examples: entries.slice(0, 2).map(e => ({
          text: e.text.slice(0, 150),
          reason: e.reason,
        })),
      });
    }
  }
  return result;
}

/**
 * Build fragment categories (pure function).
 */
export function buildFragmentCategories(
  soulText: SoulText,
  config: WriterConfig,
): Array<{ name: string; focusLabel: string; items: Array<{ text: string }> }> {
  const focusCategories = config.focusCategories;
  const result: Array<{ name: string; focusLabel: string; items: Array<{ text: string }> }> = [];
  for (const [category, fragments] of soulText.fragments) {
    if (fragments.length === 0) continue;
    const isFocus = focusCategories?.includes(category);
    const count = isFocus ? Math.min(3, fragments.length) : Math.min(1, fragments.length);
    result.push({
      name: category,
      focusLabel: isFocus ? '（重点）' : '',
      items: fragments.slice(0, count).map(f => ({ text: f.text })),
    });
  }
  return result;
}
