import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { ReaderPersona } from '../schemas/reader-personas.js';
import type { PersonaEvaluation, CategoryScores } from './types.js';

/**
 * Reader evaluator that evaluates text from a single persona's perspective
 */
export class ReaderEvaluator {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private persona: ReaderPersona;

  constructor(
    llmClient: LLMClient,
    soulText: SoulText,
    persona: ReaderPersona
  ) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.persona = persona;
  }

  /**
   * Evaluate text from this persona's perspective
   */
  async evaluate(text: string): Promise<PersonaEvaluation> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(text);

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.3,
    });

    return this.parseResponse(response);
  }

  private buildSystemPrompt(): string {
    const parts: string[] = [];

    parts.push(
      `あなたは「${this.persona.name}」という読者ペルソナとして小説を評価する評論家です。`
    );
    parts.push('');

    // Persona profile
    parts.push('## あなたのプロフィール');
    parts.push(this.persona.description);
    parts.push('');

    // Preferences
    parts.push('## あなたが重視する観点');
    for (const pref of this.persona.preferences) {
      parts.push(`- ${pref}`);
    }
    parts.push('');

    // Evaluation criteria
    parts.push('## 評価基準');
    parts.push(
      '以下の5項目について、0.0〜1.0のスコアで評価してください：'
    );
    parts.push('');
    parts.push(
      '1. **style（文体）**: 文章のリズム、表現の独自性、言葉選び'
    );
    parts.push('2. **plot（プロット）**: 物語の展開、構成、伏線');
    parts.push(
      '3. **character（キャラクター）**: 人物造形、心理描写、一貫性'
    );
    parts.push(
      '4. **worldbuilding（世界観）**: 設定の緻密さ、SF的整合性'
    );
    parts.push('5. **readability（可読性）**: 読みやすさ、テンポ、流れ');
    parts.push('');

    // Output format
    parts.push('## 回答形式');
    parts.push('必ず以下のJSON形式で回答してください：');
    parts.push('');
    parts.push('```json');
    parts.push('{');
    parts.push('  "categoryScores": {');
    parts.push('    "style": 0.0-1.0,');
    parts.push('    "plot": 0.0-1.0,');
    parts.push('    "character": 0.0-1.0,');
    parts.push('    "worldbuilding": 0.0-1.0,');
    parts.push('    "readability": 0.0-1.0');
    parts.push('  },');
    parts.push('  "feedback": "具体的な評価コメント（100〜200文字）"');
    parts.push('}');
    parts.push('```');

    return parts.join('\n');
  }

  private buildUserPrompt(text: string): string {
    const parts: string[] = [];

    parts.push('## 評価対象テキスト');
    parts.push('```');
    parts.push(text);
    parts.push('```');
    parts.push('');
    parts.push(
      'このテキストを評価し、JSON形式で回答してください。'
    );

    return parts.join('\n');
  }

  private parseResponse(response: string): PersonaEvaluation {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    let categoryScores: CategoryScores;
    let feedback: string;

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        categoryScores = this.normalizeScores(parsed.categoryScores);
        feedback = parsed.feedback || 'フィードバックなし';
      } catch {
        // Fallback on parse error
        categoryScores = this.getDefaultScores();
        feedback = 'JSON解析エラー: ' + response.slice(0, 100);
      }
    } else {
      // Fallback when no JSON found
      categoryScores = this.getDefaultScores();
      feedback = 'JSON未検出: ' + response.slice(0, 100);
    }

    const weightedScore = this.calculateWeightedScore(categoryScores);

    return {
      personaId: this.persona.id,
      personaName: this.persona.name,
      categoryScores,
      weightedScore,
      feedback,
    };
  }

  private normalizeScores(
    scores: Partial<CategoryScores> | undefined
  ): CategoryScores {
    return {
      style: this.clampScore(scores?.style),
      plot: this.clampScore(scores?.plot),
      character: this.clampScore(scores?.character),
      worldbuilding: this.clampScore(scores?.worldbuilding),
      readability: this.clampScore(scores?.readability),
    };
  }

  private clampScore(score: number | undefined): number {
    if (score === undefined || isNaN(score)) return 0.5;
    return Math.max(0, Math.min(1, score));
  }

  private getDefaultScores(): CategoryScores {
    return {
      style: 0.5,
      plot: 0.5,
      character: 0.5,
      worldbuilding: 0.5,
      readability: 0.5,
    };
  }

  private calculateWeightedScore(scores: CategoryScores): number {
    const w = this.persona.evaluation_weights;
    return (
      scores.style * w.style +
      scores.plot * w.plot +
      scores.character * w.character +
      scores.worldbuilding * w.worldbuilding +
      scores.readability * w.readability
    );
  }
}
