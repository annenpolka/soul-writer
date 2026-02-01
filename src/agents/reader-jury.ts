import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { ReaderPersona } from '../schemas/reader-personas.js';
import type { ReaderJuryResult, PersonaEvaluation } from './types.js';
import { ReaderEvaluator } from './reader-evaluator.js';

const PASSING_THRESHOLD = 0.85;

/**
 * Reader jury agent that evaluates text using multiple personas
 */
export class ReaderJuryAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private personas: ReaderPersona[];

  constructor(
    llmClient: LLMClient,
    soulText: SoulText,
    personas?: ReaderPersona[]
  ) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.personas = personas ?? soulText.readerPersonas.personas;
  }

  /**
   * Evaluate text using all personas in parallel
   */
  async evaluate(text: string, previousResult?: ReaderJuryResult): Promise<ReaderJuryResult> {
    // Run all evaluations in parallel
    const evaluations = await Promise.all(
      this.personas.map((persona) => {
        const evaluator = new ReaderEvaluator(
          this.llmClient,
          this.soulText,
          persona
        );
        const prevEval = previousResult?.evaluations.find(e => e.personaId === persona.id);
        return evaluator.evaluate(text, prevEval);
      })
    );

    const aggregatedScore = this.calculateAggregatedScore(evaluations);
    const passed = aggregatedScore >= PASSING_THRESHOLD;
    const summary = this.generateSummary(evaluations, passed);

    return {
      evaluations,
      aggregatedScore,
      passed,
      summary,
    };
  }

  private calculateAggregatedScore(evaluations: PersonaEvaluation[]): number {
    if (evaluations.length === 0) return 0;

    const sum = evaluations.reduce((acc, e) => acc + e.weightedScore, 0);
    return sum / evaluations.length;
  }

  private generateSummary(
    evaluations: PersonaEvaluation[],
    passed: boolean
  ): string {
    const parts: string[] = [];

    if (passed) {
      parts.push('読者陪審員の評価: 合格');
    } else {
      parts.push('読者陪審員の評価: 不合格');
    }

    parts.push('');
    parts.push('各ペルソナの評価:');

    for (const evaluation of evaluations) {
      const score = (evaluation.weightedScore * 100).toFixed(1);
      parts.push(`- ${evaluation.personaName}: ${score}点`);
    }

    return parts.join('\n');
  }
}
