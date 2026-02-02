import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import type { ReaderPersona } from '../schemas/reader-personas.js';
import type { PersonaEvaluation, PersonaFeedback, CategoryScores } from './types.js';
import { buildPrompt } from '../template/composer.js';

const SUBMIT_READER_EVALUATION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_reader_evaluation',
    description: '読者評価のスコアとフィードバックを提出する',
    parameters: {
      type: 'object',
      properties: {
        categoryScores: {
          type: 'object',
          properties: {
            style: { type: 'number' },
            plot: { type: 'number' },
            character: { type: 'number' },
            worldbuilding: { type: 'number' },
            readability: { type: 'number' },
          },
          required: ['style', 'plot', 'character', 'worldbuilding', 'readability'],
          additionalProperties: false,
        },
        feedback: {
          type: 'object',
          properties: {
            strengths: { type: 'string' },
            weaknesses: { type: 'string' },
            suggestion: { type: 'string' },
          },
          required: ['strengths', 'weaknesses', 'suggestion'],
          additionalProperties: false,
        },
      },
      required: ['categoryScores', 'feedback'],
      additionalProperties: false,
    },
    strict: true,
  },
};

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
      previousFeedback: previousEvaluation
        ? `[良] ${previousEvaluation.feedback.strengths} [課題] ${previousEvaluation.feedback.weaknesses} [提案] ${previousEvaluation.feedback.suggestion}`
        : '',
      previousScores: previousEvaluation ? JSON.stringify(previousEvaluation.categoryScores) : '',
    };

    const { system: systemPrompt, user: userPrompt } = buildPrompt('reader-evaluator', context);

    assertToolCallingClient(this.llmClient);
    const response = await this.llmClient.completeWithTools(
      systemPrompt,
      userPrompt,
      [SUBMIT_READER_EVALUATION_TOOL],
      {
        toolChoice: { type: 'function', function: { name: 'submit_reader_evaluation' } },
        temperature: 0.3,
      },
    );

    return this.parseToolResponse(response);
  }

  private parseToolResponse(response: ToolCallResponse): PersonaEvaluation {
    let categoryScores: CategoryScores;
    let feedback: PersonaFeedback;

    const defaultFeedback: PersonaFeedback = {
      strengths: '',
      weaknesses: '',
      suggestion: '',
    };

    let parsed: unknown;
    try {
      parsed = parseToolArguments<unknown>(response, 'submit_reader_evaluation');
    } catch {
      parsed = null;
    }

    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as {
        categoryScores?: Partial<CategoryScores>;
        feedback?: Partial<PersonaFeedback> | string;
      };
      categoryScores = this.normalizeScores(candidate.categoryScores);
      if (candidate.feedback && typeof candidate.feedback === 'object') {
        const fb = candidate.feedback as Partial<PersonaFeedback>;
        feedback = {
          strengths: fb.strengths || '',
          weaknesses: fb.weaknesses || '',
          suggestion: fb.suggestion || '',
        };
      } else {
        feedback = { ...defaultFeedback, strengths: typeof candidate.feedback === 'string' ? candidate.feedback : 'フィードバックなし' };
      }
    } else {
      categoryScores = this.getDefaultScores();
      feedback = { ...defaultFeedback, weaknesses: 'ツール呼び出しの解析に失敗' };
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
