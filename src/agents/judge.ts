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
    const parts: string[] = [];

    parts.push(`あなたは「${meta.soul_name}」の審査員です。`);
    parts.push('2つのテキストを比較し、ソウルテキストにより忠実な方を選んでください。');
    parts.push('');
    parts.push('## 評価基準');
    parts.push('1. 文体の一貫性（憲法への適合度）');
    parts.push('2. 禁止パターンの回避');
    parts.push('3. キャラクターの声の再現');
    parts.push('4. テーマの維持');
    parts.push('');
    parts.push('## 憲法の要点');
    parts.push(`- 禁止語彙: ${this.soulText.constitution.vocabulary.forbidden_words.join(', ')}`);
    parts.push(`- 特殊記号: ${this.soulText.constitution.vocabulary.special_marks.mark} - ${this.soulText.constitution.vocabulary.special_marks.usage}`);
    parts.push(`- 禁止比喩: ${this.soulText.constitution.rhetoric.forbidden_similes.join(', ')}`);
    parts.push('');
    parts.push('回答はJSON形式で返してください:');
    parts.push('```json');
    parts.push('{');
    parts.push('  "winner": "A" または "B",');
    parts.push('  "reasoning": "選択理由",');
    parts.push('  "scores": {');
    parts.push('    "A": { "style": 0-1, "compliance": 0-1, "overall": 0-1 },');
    parts.push('    "B": { "style": 0-1, "compliance": 0-1, "overall": 0-1 }');
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
      };
    } catch {
      return this.createFallbackResult(response);
    }
  }

  private normalizeScore(score: Partial<ScoreBreakdown> | undefined): ScoreBreakdown {
    return {
      style: score?.style ?? 0.5,
      compliance: score?.compliance ?? 0.5,
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
