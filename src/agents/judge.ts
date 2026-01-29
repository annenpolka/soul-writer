import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { JudgeResult, ScoreBreakdown } from './types.js';

export type { JudgeResult };

/**
 * Judge agent that evaluates and compares two texts
 */
export class JudgeAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  /**
   * Evaluate two texts and determine the winner
   */
  async evaluate(textA: string, textB: string): Promise<JudgeResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(textA, textB);

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.3, // Low temperature for consistent judging
    });

    return this.parseResponse(response);
  }

  private buildSystemPrompt(): string {
    const meta = this.soulText.constitution.meta;
    const constitution = this.soulText.constitution;
    const parts: string[] = [];

    parts.push(`あなたは「${meta.soul_name}」の厳格な審査員です。`);
    parts.push('2つのテキストを比較し、原作の文体・語り口・世界観により忠実な方を選んでください。');
    parts.push('');
    parts.push('## 評価基準（重要度順）');
    parts.push('1. **語り声の再現** (voice_accuracy): 一人称「わたし」、冷徹で乾いた語り口、短文リズム');
    parts.push('2. **原作忠実度** (originality_fidelity): 原作の設定・キャラクター造形を捏造せず忠実に再現');
    parts.push('3. **文体の一貫性** (style): 短-短-長(内省)-短(断定)のリズム、体言止め、比喩密度low');
    parts.push('4. **禁止パターンの回避** (compliance): 禁止語彙、禁止比喩、「×」の正しい用法');
    parts.push('');
    parts.push('## 具体的な減点対象');
    parts.push('- 「私」表記（「わたし」でなければならない）→ 大幅減点');
    parts.push('- 三人称的な外部描写の混入 → 大幅減点');
    parts.push('- つるぎの台詞が説明的・解説的になっている → 減点');
    parts.push('- 原作にない設定やキャラクターの捏造 → 大幅減点');
    parts.push('- 陳腐な比喩の多用（「死んだ魚のような」「井戸の底のような」等） → 減点');
    parts.push('- 装飾過多な長文の連続 → 減点');
    parts.push('');

    // Key constitution rules
    parts.push('## 憲法の要点');
    parts.push(`- リズム: ${constitution.sentence_structure.rhythm_pattern}`);
    parts.push(`- 禁止語彙: ${constitution.vocabulary.forbidden_words.join(', ')}`);
    parts.push(`- 特殊記号「${constitution.vocabulary.special_marks.mark}」: ${constitution.vocabulary.special_marks.usage}`);
    parts.push(`- 禁止比喩: ${constitution.rhetoric.forbidden_similes.join(', ')}`);
    parts.push(`- 視点: ${constitution.narrative.default_pov}`);
    parts.push(`- 対話比率: ${constitution.narrative.dialogue_ratio}`);
    parts.push('');

    // Character voice references
    parts.push('## キャラクター別の口調');
    for (const [charName, style] of Object.entries(constitution.narrative.dialogue_style_by_character)) {
      parts.push(`- ${charName}: ${style}`);
    }
    parts.push('');

    // Anti-soul examples
    parts.push('## 反魂（こういう文章を選ぶな）');
    for (const [category, entries] of Object.entries(this.soulText.antiSoul.categories)) {
      for (const entry of entries.slice(0, 1)) {
        parts.push(`- ${category}: 「${entry.text.slice(0, 100)}」→ ${entry.reason}`);
      }
    }
    parts.push('');

    // Reference fragments for comparison
    parts.push('## 原作の参考断片（この文体が正解）');
    let fragmentCount = 0;
    for (const [category, fragments] of this.soulText.fragments) {
      if (fragments.length > 0 && fragmentCount < 4) {
        parts.push(`### ${category}`);
        parts.push('```');
        parts.push(fragments[0].text);
        parts.push('```');
        fragmentCount++;
      }
    }
    parts.push('');

    parts.push('回答はJSON形式で返してください:');
    parts.push('```json');
    parts.push('{');
    parts.push('  "winner": "A" または "B",');
    parts.push('  "reasoning": "選択理由（具体的にどの点が優れていたか）",');
    parts.push('  "scores": {');
    parts.push('    "A": { "style": 0-1, "compliance": 0-1, "voice_accuracy": 0-1, "originality_fidelity": 0-1, "overall": 0-1 },');
    parts.push('    "B": { "style": 0-1, "compliance": 0-1, "voice_accuracy": 0-1, "originality_fidelity": 0-1, "overall": 0-1 }');
    parts.push('  },');
    parts.push('  "praised_excerpts": {');
    parts.push('    "A": ["テキストAで特に優れていた表現・描写の引用（原文ママ、各50字以内、最大3つ）"],');
    parts.push('    "B": ["テキストBで特に優れていた表現・描写の引用（原文ママ、各50字以内、最大3つ）"]');
    parts.push('  }');
    parts.push('}');
    parts.push('```');

    return parts.join('\n');
  }

  private buildUserPrompt(textA: string, textB: string): string {
    const parts: string[] = [];

    parts.push('## テキストA');
    parts.push('```');
    parts.push(textA);
    parts.push('```');
    parts.push('');
    parts.push('## テキストB');
    parts.push('```');
    parts.push(textB);
    parts.push('```');
    parts.push('');
    parts.push('どちらがソウルテキストにより忠実ですか？JSON形式で回答してください。');

    return parts.join('\n');
  }

  private parseResponse(response: string): JudgeResult {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback if no JSON found
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
    // Simple heuristic: check if response mentions A or B more favorably
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
