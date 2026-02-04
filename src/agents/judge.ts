import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import type { JudgeResult, ScoreBreakdown, ThemeContext } from './types.js';
import { type NarrativeRules, resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildPrompt } from '../template/composer.js';

export type { JudgeResult };

const SUBMIT_JUDGEMENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_judgement',
    description: '勝者判定とスコアを提出する',
    parameters: {
      type: 'object',
      properties: {
        winner: { type: 'string', enum: ['A', 'B'] },
        reasoning: { type: 'string' },
        scores: {
          type: 'object',
          properties: {
            A: {
              type: 'object',
              properties: {
                style: { type: 'number' },
                compliance: { type: 'number' },
                overall: { type: 'number' },
                voice_accuracy: { type: 'number' },
                originality_fidelity: { type: 'number' },
                narrative_quality: { type: 'number' },
                novelty: { type: 'number' },
              },
              required: ['style', 'compliance', 'overall'],
              additionalProperties: false,
            },
            B: {
              type: 'object',
              properties: {
                style: { type: 'number' },
                compliance: { type: 'number' },
                overall: { type: 'number' },
                voice_accuracy: { type: 'number' },
                originality_fidelity: { type: 'number' },
                narrative_quality: { type: 'number' },
                novelty: { type: 'number' },
              },
              required: ['style', 'compliance', 'overall'],
              additionalProperties: false,
            },
          },
          required: ['A', 'B'],
          additionalProperties: false,
        },
        praised_excerpts: {
          type: 'object',
          properties: {
            A: { type: 'array', items: { type: 'string' } },
            B: { type: 'array', items: { type: 'string' } },
          },
          required: ['A', 'B'],
          additionalProperties: false,
        },
      },
      required: ['winner', 'reasoning', 'scores'],
      additionalProperties: false,
    },
    strict: true,
  },
};

/**
 * Judge agent that evaluates and compares two texts
 */
export class JudgeAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private narrativeRules: NarrativeRules;
  private themeContext?: ThemeContext;

  constructor(llmClient: LLMClient, soulText: SoulText, narrativeRules?: NarrativeRules, themeContext?: ThemeContext) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.narrativeRules = narrativeRules ?? resolveNarrativeRules();
    this.themeContext = themeContext;
  }

  /**
   * Evaluate two texts and determine the winner
   */
  async evaluate(textA: string, textB: string): Promise<JudgeResult> {
    const context = this.buildContext(textA, textB);
    const { system: systemPrompt, user: userPrompt } = buildPrompt('judge', context);

    assertToolCallingClient(this.llmClient);
    const response = await this.llmClient.completeWithTools(
      systemPrompt,
      userPrompt,
      [SUBMIT_JUDGEMENT_TOOL],
      {
        toolChoice: { type: 'function', function: { name: 'submit_judgement' } },
        temperature: 0.3,
      },
    );

    return this.parseToolResponse(response);
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
    criteriaEntries.push({ text: '3. **新奇さ** (novelty): 予想外の展開、新鮮な表現・比喩、キャラクターの未知の側面。原作の精神を継ぎつつ超える力。【重視】多様なスタイルの作家が競うため、独自の切り口を高く評価すること' });
    criteriaEntries.push({ text: '4. **文体の一貫性** (style): 短-短-長(内省)-短(断定)のリズム、体言止め、比喩密度low' });
    criteriaEntries.push({ text: '5. **禁止パターンの回避** (compliance): 禁止語彙、禁止比喩、「×」の正しい用法' });
    criteriaEntries.push({ text: '6. **物語性** (narrative_quality): 読者を引き込む没入感、感情の重み、構成力。形式ルール遵守だけでは高得点にならない' });

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
      themeContext: this.themeContext,
      textA,
      textB,
    };
  }

  private parseToolResponse(response: ToolCallResponse): JudgeResult {
    let parsed: unknown;
    try {
      parsed = parseToolArguments<unknown>(response, 'submit_judgement');
    } catch {
      return this.createFallbackResult();
    }

    try {
      const candidate = parsed as {
        winner?: string;
        reasoning?: string;
        scores?: { A?: Partial<ScoreBreakdown>; B?: Partial<ScoreBreakdown> };
        praised_excerpts?: { A?: unknown; B?: unknown };
      };
      return {
        winner: candidate.winner === 'B' ? 'B' : 'A',
        reasoning: candidate.reasoning || 'No reasoning provided',
        scores: {
          A: this.normalizeScore(candidate.scores?.A),
          B: this.normalizeScore(candidate.scores?.B),
        },
        praised_excerpts: {
          A: Array.isArray(candidate.praised_excerpts?.A) ? candidate.praised_excerpts?.A as string[] : [],
          B: Array.isArray(candidate.praised_excerpts?.B) ? candidate.praised_excerpts?.B as string[] : [],
        },
      };
    } catch {
      return this.createFallbackResult();
    }
  }

  private normalizeScore(score: Partial<ScoreBreakdown> | undefined): ScoreBreakdown {
    const clamp = (v: number | undefined) => {
      const val = v ?? 0.5;
      return Math.min(0.95, Math.max(0.05, val));
    };
    return {
      style: clamp(score?.style),
      compliance: clamp(score?.compliance),
      voice_accuracy: clamp(score?.voice_accuracy),
      originality_fidelity: clamp(score?.originality_fidelity),
      narrative_quality: clamp(score?.narrative_quality),
      novelty: clamp(score?.novelty),
      overall: clamp(score?.overall),
    };
  }

  private createFallbackResult(): JudgeResult {
    return {
      winner: 'A',
      reasoning: 'Fallback: tool call parsing failed',
      scores: {
        A: { style: 0.5, compliance: 0.5, voice_accuracy: 0.5, originality_fidelity: 0.5, narrative_quality: 0.5, novelty: 0.5, overall: 0.5 },
        B: { style: 0.5, compliance: 0.5, voice_accuracy: 0.5, originality_fidelity: 0.5, narrative_quality: 0.5, novelty: 0.5, overall: 0.5 },
      },
    };
  }
}
