import type { SoulText } from '../../soul/manager.js';
import type { GenerationResult, ThemeContext } from '../types.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';
import type { MatchResult } from '../../tournament/arena.js';

export interface LoserExcerpt {
  writerId: string;
  excerpts: string[];
  reasoning: string;
}

export interface SynthesisSystemPromptInput {
  soulText: SoulText;
  narrativeRules: NarrativeRules;
  themeContext?: ThemeContext;
}

/**
 * Pure function: collect praised excerpts from losers across all tournament rounds.
 */
export function collectLoserExcerpts(
  championId: string,
  allGenerations: GenerationResult[],
  rounds: MatchResult[],
): LoserExcerpt[] {
  const loserIds = allGenerations
    .filter(g => g.writerId !== championId)
    .map(g => g.writerId);

  const results: LoserExcerpt[] = [];

  for (const loserId of loserIds) {
    const excerpts: string[] = [];
    const reasonings: string[] = [];

    for (const match of rounds) {
      const isA = match.contestantA === loserId;
      const isB = match.contestantB === loserId;
      if (!isA && !isB) continue;

      const side = isA ? 'A' : 'B';
      const praised = match.judgeResult.praised_excerpts?.[side];
      if (praised && praised.length > 0) {
        excerpts.push(...praised);
      }

      if (match.judgeResult.reasoning) {
        reasonings.push(match.judgeResult.reasoning);
      }
    }

    if (excerpts.length > 0 || reasonings.length > 0) {
      results.push({
        writerId: loserId,
        excerpts,
        reasoning: reasonings.join(' / '),
      });
    }
  }

  return results;
}

/**
 * Pure function: build the system prompt for synthesis.
 */
export function buildSynthesisSystemPrompt(input: SynthesisSystemPromptInput): string {
  const { soulText, narrativeRules, themeContext } = input;
  const constitution = soulText.constitution;
  const parts: string[] = [];

  parts.push('あなたは合成編集者です。');
  parts.push('トーナメントの審査員が各テキストから抽出した「優れた表現」を、勝者テキストに自然に織り込みます。');
  parts.push('');
  parts.push('【合成ルール】');
  parts.push('- ベーステキスト（勝者作品）の構造・プロット・声を維持すること');
  parts.push('- 取り込むのは「表現の質感」「イメージの鮮度」「感情の動きの精度」のみ');
  parts.push('- プロットや設定を変更しない');
  parts.push('- ベーステキストの文字数を大幅に変えない（±10%以内）');
  parts.push(`- 視点: ${narrativeRules.povDescription}`);
  if (narrativeRules.pronoun) {
    parts.push(`- 人称代名詞: 「${narrativeRules.pronoun}」を使用`);
  }
  parts.push('- 合成の痕跡が見えないよう、自然に織り込むこと');
  parts.push('- 引用された表現をそのまま挿入するのではなく、文脈に溶け込む形で取り入れる');
  parts.push('');

  if (themeContext) {
    parts.push('【テーマ・トーン】');
    parts.push(`- 感情: ${themeContext.emotion}`);
    parts.push(`- 時間軸: ${themeContext.timeline}`);
    parts.push(`- 前提: ${themeContext.premise}`);
    if (themeContext.tone) {
      parts.push(`- 創作指針: ${themeContext.tone}`);
    }
    parts.push('');
  }

  const u = constitution.universal;
  const ps = constitution.protagonist_specific;
  parts.push('【文体基準】');
  parts.push(`- リズム: ${ps.sentence_structure.rhythm_pattern}`);
  parts.push(`- 禁止語彙: ${u.vocabulary.forbidden_words.join(', ')}`);
  parts.push(`- 比喩基盤: ${u.rhetoric.simile_base}`);
  parts.push(`- 禁止比喩: ${u.rhetoric.forbidden_similes.join(', ')}`);
  parts.push('');
  parts.push('出力はテキスト本文のみ。メタ情報や説明は含めないこと。');

  return parts.join('\n');
}

/**
 * Pure function: build the user prompt for synthesis.
 */
export function buildSynthesisUserPrompt(
  championText: string,
  loserExcerpts: LoserExcerpt[],
): string {
  const parts: string[] = [];

  parts.push('## ベーステキスト（勝者作品）');
  parts.push(championText);
  parts.push('');

  parts.push('## 落選テキストから抽出された優良表現');
  for (const loser of loserExcerpts) {
    parts.push(`### ${loser.writerId}`);
    if (loser.reasoning) {
      parts.push(`審査員コメント: ${loser.reasoning}`);
    }
    if (loser.excerpts.length > 0) {
      parts.push('優れた表現:');
      for (const excerpt of loser.excerpts) {
        parts.push(`- 「${excerpt}」`);
      }
    }
    parts.push('');
  }

  parts.push('上記の優良表現のエッセンスをベーステキストに自然に織り込んでください。');
  parts.push('構造やプロットは変えず、表現の質を高めることが目的です。');

  return parts.join('\n');
}
