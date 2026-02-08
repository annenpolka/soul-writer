import type { SoulText } from '../../soul/manager.js';
import type { ThemeContext } from '../types.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';

/**
 * Input for buildJudgeContext
 */
export interface JudgeContextInput {
  soulText: SoulText;
  narrativeRules: NarrativeRules;
  textA: string;
  textB: string;
  themeContext?: ThemeContext;
}

/**
 * Build the full template context for a judge prompt (pure function).
 */
export function buildJudgeContext(input: JudgeContextInput): Record<string, unknown> {
  const { soulText, narrativeRules, textA, textB, themeContext } = input;
  const constitution = soulText.constitution;
  const { isDefaultProtagonist, pov } = narrativeRules;

  // Evaluation criteria
  const criteriaEntries: Array<{ text: string }> = [];
  if (isDefaultProtagonist && pov === 'first-person') {
    criteriaEntries.push({ text: '1. **語り声の再現** (voice_accuracy): 一人称「わたし」、冷徹で乾いた語り口、短文リズム' });
    criteriaEntries.push({ text: '2. **独自性** (originality): 原作の精神を独自のアプローチで拡張しているか。安全だが平凡より挑戦的で荒削りを好む' });
  } else {
    criteriaEntries.push({ text: `1. **語り声の一貫性** (voice_accuracy): ${narrativeRules.povDescription}。冷徹で乾いた語り口、短文リズム` });
    criteriaEntries.push({ text: '2. **独自性** (originality): 原作の精神を独自のアプローチで拡張しているか' });
  }
  criteriaEntries.push({ text: '3. **文体の一貫性** (style): 短-短-長(内省)-短(断定)のリズム、体言止め、比喩密度low' });
  criteriaEntries.push({ text: '4. **構成** (structure): シーン配置、ペーシング、構造的な強度' });
  criteriaEntries.push({ text: '5. **感情振幅** (amplitude): 感情曲線にピークとボトムがあるか。全編フラットは低評価' });
  criteriaEntries.push({ text: '6. **行動性** (agency): キャラクターが実際に選択し行動しているか。受動的な観察だけのパターンは低評価' });
  criteriaEntries.push({ text: '7. **賭け金** (stakes): 物語に何が賭けられているか明確か。失敗の代償が具体的に描かれているか' });
  criteriaEntries.push({ text: '8. **禁止パターンの回避** (compliance): 禁止語彙、禁止比喩、「×」の正しい用法' });

  // Penalty items
  const penaltyEntries: Array<{ text: string }> = [];
  if (isDefaultProtagonist && pov === 'first-person') {
    penaltyEntries.push({ text: '「私」表記（「わたし」でなければならない）→ 大幅減点' });
  } else {
    penaltyEntries.push({ text: '視点の一貫性が崩れている → 大幅減点' });
    penaltyEntries.push({ text: '世界観に存在し得ない設定の捏造 → 大幅減点' });
  }
  const judgeConfig = soulText.promptConfig?.agents?.judge;
  if (judgeConfig?.penalty_items) {
    for (const item of judgeConfig.penalty_items) {
      penaltyEntries.push({ text: item });
    }
  }
  penaltyEntries.push({ text: '陳腐な比喩の多用（「死んだ魚のような」「井戸の底のような」等） → 減点' });
  penaltyEntries.push({ text: '装飾過多な長文の連続 → 減点' });

  // Character voice
  const voiceEntries: Array<{ name: string; style: string }> = [];
  const voiceRules = judgeConfig?.character_voice_rules;
  if (voiceRules && Object.keys(voiceRules).length > 0) {
    for (const [charName, style] of Object.entries(voiceRules)) {
      voiceEntries.push({ name: charName, style: style as string });
    }
  } else {
    for (const [charName, style] of Object.entries(constitution.protagonist_specific.narrative.dialogue_style_by_character)) {
      voiceEntries.push({ name: charName, style: style as string });
    }
  }

  // Anti-soul (compact: 1 per category, 100 char limit)
  const antiSoulCompactEntries: Array<{ category: string; text: string; reason: string }> = [];
  for (const [category, entries] of Object.entries(soulText.antiSoul.categories)) {
    for (const entry of entries.slice(0, 1)) {
      antiSoulCompactEntries.push({
        category,
        text: entry.text.slice(0, 100),
        reason: entry.reason,
      });
    }
  }

  // Fragments (compact: max 4 categories, 1 per category)
  const fragmentCompactCategories: Array<{ name: string; text: string }> = [];
  let fragmentCount = 0;
  for (const [category, fragments] of soulText.fragments) {
    if (fragments.length > 0 && fragmentCount < 4) {
      fragmentCompactCategories.push({ name: category, text: fragments[0].text });
      fragmentCount++;
    }
  }

  const ctx: Record<string, unknown> = {
    criteriaEntries,
    penaltyEntries,
    constitution,
    narrativeRules,
    voiceEntries,
    antiSoulCompactEntries: antiSoulCompactEntries.length > 0 ? antiSoulCompactEntries : undefined,
    fragmentCompactCategories: fragmentCompactCategories.length > 0 ? fragmentCompactCategories : undefined,
    textA,
    textB,
  };

  if (themeContext) {
    ctx.themeContext = themeContext;
  }

  return ctx;
}
