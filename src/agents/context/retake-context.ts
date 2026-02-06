import type { SoulText } from '../../soul/manager.js';
import type { ThemeContext } from '../types.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';
import { buildPovRules } from '../../factory/narrative-rules.js';

export interface RetakeSystemPromptInput {
  soulText: SoulText;
  narrativeRules: NarrativeRules;
  themeContext?: ThemeContext;
}

/**
 * Pure function: build the system prompt for retake.
 */
export function buildRetakeSystemPrompt(input: RetakeSystemPromptInput): string {
  const { soulText, narrativeRules, themeContext } = input;
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
  parts.push(`- リズム: ${ps.sentence_structure.rhythm_pattern}`);
  parts.push(`- 禁止語彙: ${u.vocabulary.forbidden_words.join(', ')}`);
  parts.push(`- 禁止比喩: ${u.rhetoric.forbidden_similes.join(', ')}`);
  parts.push('');

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

  // Reference fragments
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

  return parts.join('\n');
}

/**
 * Pure function: build the user prompt for retake.
 */
export function buildRetakeUserPrompt(originalText: string, feedback: string): string {
  const parts: string[] = [];
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
