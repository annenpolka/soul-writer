import type { SoulText } from '../../soul/manager.js';
import type { ThemeContext } from '../types.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';
import { buildPovRules } from '../../factory/narrative-rules.js';

export interface RetakeSystemPromptInput {
  soulText: SoulText;
  narrativeRules: NarrativeRules;
  themeContext?: ThemeContext;
  defectCategories?: string[];
}

/**
 * Pure function: build the system prompt for retake.
 */
export function buildRetakeSystemPrompt(input: RetakeSystemPromptInput): string {
  const { soulText, narrativeRules, themeContext, defectCategories } = input;
  const constitution = soulText.constitution;
  const parts: string[] = [];

  parts.push('あなたはリテイク専門家です。');
  parts.push('提示されたテキストを、フィードバックに基づいて原作により忠実な形に書き直してください。');
  parts.push('');
  parts.push('【絶対厳守】プレーンテキストのみ出力。***、**、#、---、```等のMarkdown記法は一切禁止。セクション区切りには空行のみ使用。');
  parts.push('');
  parts.push('【絶対ルール】');
  for (const rule of buildPovRules(narrativeRules)) {
    parts.push(rule);
  }
  parts.push('- 冷徹・簡潔・乾いた語り口');
  if (narrativeRules.isDefaultProtagonist) {
    parts.push('- 原作にない設定やキャラクターを捏造しない');
  } else {
    parts.push('- この世界観に存在し得る設定・キャラクターを使用すること');
  }
  const u = constitution.universal;
  const ps = constitution.protagonist_specific;
  if (ps.sentence_structure.rhythm_pattern) {
    parts.push(`- リズム: ${ps.sentence_structure.rhythm_pattern}`);
  }
  parts.push(`- 禁止語彙: ${u.vocabulary.forbidden_words.join(', ')}`);
  parts.push(`- 禁止比喩: ${u.rhetoric.forbidden_similes.join(', ')}`);
  parts.push('');

  // Agency-specific guidance when agency_absence detected
  if (defectCategories?.includes('agency_absence')) {
    parts.push('## 動作の美学（この修正で特に重要）');
    parts.push('行動は引き算と同じ原則で描く。動機を説明せず、身体的ディテールと結果だけを示す。');
    parts.push('行動には「不可逆性」がある。行動の前後で世界が変わること。');
    parts.push('- 行動の瞬間を身体感覚で描く');
    parts.push('- 意思決定は一文で切る');
    parts.push('- 「見る→感じる→考える」だけで終わるシーンを作らない。観察は行動への助走');
    parts.push('');
  }

  if (themeContext) {
    parts.push('## テーマ・トーン');
    parts.push(`- 感情: ${themeContext.emotion}`);
    parts.push(`- 時間軸: ${themeContext.timeline}`);
    parts.push(`- 前提: ${themeContext.premise}`);
    if (themeContext.tone) {
      parts.push(`- 創作指針: ${themeContext.tone}`);
    }
    parts.push('');
  }

  // Character voice reference
  parts.push('## キャラクター対話スタイル');
  for (const [charName, style] of Object.entries(ps.narrative.dialogue_style_by_character)) {
    parts.push(`- ${charName}: ${style}`);
  }
  parts.push('');

  // Anti-soul patterns matching detected defect categories
  const antiSoulPatterns = getRelevantAntiSoulPatterns(soulText, defectCategories);
  if (antiSoulPatterns.length > 0) {
    parts.push('## 以下のように書いてはいけない（反魂パターン）');
    for (const pattern of antiSoulPatterns) {
      parts.push(`- [${pattern.category}] 「${pattern.text.slice(0, 100)}」 — ${pattern.reason}`);
    }
    parts.push('');
  }

  // Category-aware fragment selection
  const relevantFragments = getRelevantFragments(soulText, defectCategories);
  if (relevantFragments.length > 0) {
    parts.push('## 原作の文体参考（この修正に特に関連する例）');
    for (const frag of relevantFragments) {
      parts.push(`### ${frag.category}`);
      parts.push('```');
      parts.push(frag.text);
      parts.push('```');
    }
  } else {
    // Fallback: generic fragments
    parts.push('## 原作の文体参考');
    let count = 0;
    for (const [category, fragments] of soulText.fragments) {
      if (fragments.length > 0 && count < 3) {
        parts.push(`### ${category}`);
        parts.push('```');
        parts.push(fragments[0].text);
        parts.push('```');
        count++;
      }
    }
  }

  return parts.join('\n');
}

export interface RetakeUserPromptInput {
  originalText: string;
  feedback: string;
  plotChapter?: { summary: string; keyEvents: string[]; decisionPoint?: { action: string; stakes: string; irreversibility: string } };
}

/**
 * Pure function: build the user prompt for retake.
 */
export function buildRetakeUserPrompt(input: RetakeUserPromptInput): string;
export function buildRetakeUserPrompt(originalText: string, feedback: string): string;
export function buildRetakeUserPrompt(
  originalTextOrInput: string | RetakeUserPromptInput,
  feedbackArg?: string,
): string {
  const originalText = typeof originalTextOrInput === 'string' ? originalTextOrInput : originalTextOrInput.originalText;
  const feedback = typeof originalTextOrInput === 'string' ? feedbackArg! : originalTextOrInput.feedback;
  const plotChapter = typeof originalTextOrInput === 'string' ? undefined : originalTextOrInput.plotChapter;

  const parts: string[] = [];

  // Plot context for this chapter
  if (plotChapter) {
    parts.push('## この章のプロット');
    parts.push(`概要: ${plotChapter.summary}`);
    parts.push(`主要イベント: ${plotChapter.keyEvents.join('、')}`);
    if (plotChapter.decisionPoint) {
      parts.push(`決定的行動: ${plotChapter.decisionPoint.action}`);
      parts.push(`賭け金: ${plotChapter.decisionPoint.stakes}`);
      parts.push(`不可逆な変化: ${plotChapter.decisionPoint.irreversibility}`);
      parts.push('この行動を必ず物語に組み込むこと。');
    }
    parts.push('');
  }

  parts.push('## 書き直し対象テキスト');
  parts.push('```');
  parts.push(originalText);
  parts.push('```');
  parts.push('');
  parts.push('## フィードバック（修正すべき問題）');
  parts.push(feedback);
  parts.push('');
  parts.push(`【文字数厳守】元のテキストは${originalText.length}文字です。書き直し後も同程度の文字数（±10%以内、${Math.round(originalText.length * 0.9)}〜${Math.round(originalText.length * 1.1)}文字）を維持してください。大幅な短縮は禁止です。`);
  parts.push('');
  parts.push('上記のフィードバックに基づいて、テキスト全体を原作の文体に忠実に書き直してください。');
  parts.push('元のプロット・シーン展開は維持しつつ、文体・語り口・キャラクター描写を改善してください。');
  return parts.join('\n');
}

/**
 * Get anti-soul patterns relevant to detected defect categories.
 */
function getRelevantAntiSoulPatterns(
  soulText: SoulText,
  defectCategories?: string[],
): Array<{ category: string; text: string; reason: string }> {
  if (!defectCategories || defectCategories.length === 0) return [];
  if (!soulText.antiSoul) return [];

  const categoryMapping: Record<string, string[]> = {
    agency_absence: ['passive_narrative'],
    forbidden_pattern: ['structural_monotony', 'ar_reality_cliche'],
    motif_fatigue: ['structural_monotony'],
    emotional_flatness: ['passive_narrative'],
    style_deviation: ['generic_literary'],
  };

  const targetCategories = new Set<string>();
  for (const defectCat of defectCategories) {
    const mapped = categoryMapping[defectCat];
    if (mapped) {
      for (const m of mapped) targetCategories.add(m);
    }
  }

  const results: Array<{ category: string; text: string; reason: string }> = [];
  for (const [category, entries] of Object.entries(soulText.antiSoul.categories)) {
    if (targetCategories.has(category) && Array.isArray(entries)) {
      for (const p of entries.slice(0, 2)) {
        if (p && typeof p === 'object' && 'text' in p && 'reason' in p) {
          results.push({ category, text: String(p.text), reason: String(p.reason) });
        }
      }
    }
  }
  return results;
}

/**
 * Get fragments relevant to detected defect categories.
 */
function getRelevantFragments(
  soulText: SoulText,
  defectCategories?: string[],
): Array<{ category: string; text: string }> {
  if (!defectCategories || defectCategories.length === 0) return [];

  const categoryMapping: Record<string, string[]> = {
    agency_absence: ['action', 'killing', 'dialogue'],
    emotional_flatness: ['dialogue', 'killing', 'introspection'],
    motif_fatigue: ['opening', 'world_building', 'symbolism'],
    style_deviation: ['introspection', 'character_voice'],
    pacing_issue: ['opening', 'dialogue'],
  };

  const targetFragmentCategories = new Set<string>();
  for (const defectCat of defectCategories) {
    const mapped = categoryMapping[defectCat];
    if (mapped) {
      for (const m of mapped) targetFragmentCategories.add(m);
    }
  }

  const results: Array<{ category: string; text: string }> = [];
  for (const [category, fragments] of soulText.fragments) {
    if (targetFragmentCategories.has(category) && fragments.length > 0 && results.length < 4) {
      results.push({ category, text: fragments[0].text });
    }
  }
  return results;
}
