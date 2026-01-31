import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { JudgeResult, ScoreBreakdown } from './types.js';
import { type NarrativeRules, resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildPrompt } from '../template/composer.js';

export type { JudgeResult };

/**
 * Judge agent that evaluates and compares two texts
 */
export class JudgeAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private narrativeRules: NarrativeRules;

  constructor(llmClient: LLMClient, soulText: SoulText, narrativeRules?: NarrativeRules) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.narrativeRules = narrativeRules ?? resolveNarrativeRules();
  }

  /**
   * Evaluate two texts and determine the winner
   */
  async evaluate(textA: string, textB: string): Promise<JudgeResult> {
    const context = this.buildContext(textA, textB);
    const { system: systemPrompt, user: userPrompt } = buildPrompt('judge', context);

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.3,
    });

    return this.parseResponse(response);
  }

  private buildContext(textA: string, textB: string): Record<string, unknown> {
    const constitution = this.soulText.constitution;
    const { isDefaultProtagonist, pov } = this.narrativeRules;

    // Evaluation criteria
    const criteriaEntries: Array<{ text: string }> = [];
    if (isDefaultProtagonist && pov === 'first-person') {
      criteriaEntries.push({ text: '1. **語り声の再現** (voice_accuracy): 一人称「わたし」、冷徹で乾いた語り口、短文リズム' });
      criteriaEntries.push({ text: '2. **原作忠実度** (originality_fidelity): 原作の設定・キャラクター造形を捏造せず忠実に再現' });
    } else {
      criteriaEntries.push({ text: `1. **語り声の一貫性** (voice_accuracy): ${this.narrativeRules.povDescription}。冷徹で乾いた語り口、短文リズム` });
      criteriaEntries.push({ text: '2. **世界観忠実度** (originality_fidelity): この世界観に存在し得る設定・キャラクターを使用しているか' });
    }
    criteriaEntries.push({ text: '3. **文体の一貫性** (style): 短-短-長(内省)-短(断定)のリズム、体言止め、比喩密度low' });
    criteriaEntries.push({ text: '4. **禁止パターンの回避** (compliance): 禁止語彙、禁止比喩、「×」の正しい用法' });

    // Penalty items
    const penaltyEntries: Array<{ text: string }> = [];
    if (isDefaultProtagonist && pov === 'first-person') {
      penaltyEntries.push({ text: '「私」表記（「わたし」でなければならない）→ 大幅減点' });
      penaltyEntries.push({ text: '三人称的な外部描写の混入 → 大幅減点' });
      penaltyEntries.push({ text: '原作にない設定やキャラクターの捏造 → 大幅減点' });
    } else {
      penaltyEntries.push({ text: '視点の一貫性が崩れている → 大幅減点' });
      penaltyEntries.push({ text: '世界観に存在し得ない設定の捏造 → 大幅減点' });
    }
    const judgeConfig = this.soulText.promptConfig?.agents?.judge;
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
    for (const [category, entries] of Object.entries(this.soulText.antiSoul.categories)) {
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
    for (const [category, fragments] of this.soulText.fragments) {
      if (fragments.length > 0 && fragmentCount < 4) {
        fragmentCompactCategories.push({ name: category, text: fragments[0].text });
        fragmentCount++;
      }
    }

    return {
      criteriaEntries,
      penaltyEntries,
      constitution,
      narrativeRules: this.narrativeRules,
      voiceEntries,
      antiSoulCompactEntries: antiSoulCompactEntries.length > 0 ? antiSoulCompactEntries : undefined,
      fragmentCompactCategories: fragmentCompactCategories.length > 0 ? fragmentCompactCategories : undefined,
      textA,
      textB,
    };
  }

  private parseResponse(response: string): JudgeResult {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.createFallbackResult(response);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        winner: parsed.winner === 'B' ? 'B' : 'A',
        reasoning: parsed.reasoning || 'No reasoning provided',
        scores: {
          A: this.normalizeScore(parsed.scores?.A),
          B: this.normalizeScore(parsed.scores?.B),
        },
        praised_excerpts: {
          A: Array.isArray(parsed.praised_excerpts?.A) ? parsed.praised_excerpts.A : [],
          B: Array.isArray(parsed.praised_excerpts?.B) ? parsed.praised_excerpts.B : [],
        },
      };
    } catch {
      return this.createFallbackResult(response);
    }
  }

  private normalizeScore(score: Partial<ScoreBreakdown> | undefined): ScoreBreakdown {
    return {
      style: score?.style ?? 0.5,
      compliance: score?.compliance ?? 0.5,
      voice_accuracy: score?.voice_accuracy ?? 0.5,
      originality_fidelity: score?.originality_fidelity ?? 0.5,
      overall: score?.overall ?? 0.5,
    };
  }

  private createFallbackResult(response: string): JudgeResult {
    const mentionsA = (response.match(/[Aa].*better|prefer.*[Aa]|choose.*[Aa]/gi) || []).length;
    const mentionsB = (response.match(/[Bb].*better|prefer.*[Bb]|choose.*[Bb]/gi) || []).length;

    return {
      winner: mentionsB > mentionsA ? 'B' : 'A',
      reasoning: 'Fallback parsing: ' + response.slice(0, 100),
      scores: {
        A: { style: 0.5, compliance: 0.5, overall: 0.5 },
        B: { style: 0.5, compliance: 0.5, overall: 0.5 },
      },
    };
  }
}
