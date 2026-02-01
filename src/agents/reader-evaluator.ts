import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { ReaderPersona } from '../schemas/reader-personas.js';
import type { PersonaEvaluation, CategoryScores } from './types.js';
import { buildPrompt } from '../template/composer.js';

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
  async evaluate(text: string, previousEvaluation?: PersonaEvaluation): Promise<PersonaEvaluation> {
    const context = {
      personaName: this.persona.name,
      personaDescription: this.persona.description,
      preferencesList: this.persona.preferences.map(p => `- ${p}`).join('\n'),
      text,
      previousFeedback: previousEvaluation?.feedback ?? '',
      previousScores: previousEvaluation ? JSON.stringify(previousEvaluation.categoryScores) : '',
    };

    const { system: systemPrompt, user: userPrompt } = buildPrompt('reader-evaluator', context);

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.3,
    });

    return this.parseResponse(response);
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
        if (parsed.feedback && typeof parsed.feedback === 'object') {
          const fb = parsed.feedback;
          feedback = `[良] ${fb.strengths || ''} [課題] ${fb.weaknesses || ''} [提案] ${fb.suggestion || ''}`;
        } else {
          feedback = parsed.feedback || 'フィードバックなし';
        }
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
