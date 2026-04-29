import { z } from 'zod';
import type { LLMClient } from '../../llm/types.js';
import type { Violation, ChapterContext } from '../../agents/types.js';
import type { AsyncComplianceRule } from './async-rule.js';

interface RepetitionReport {
  repetitions: Array<{
    type: 'phrase' | 'pattern' | 'motif' | 'opening' | 'ending' | 'simile';
    description: string;
    severity: 'warning' | 'error';
    examples: string[];
  }>;
}

const RepetitionReportSchema = z.object({
  repetitions: z.array(z.object({
    type: z.enum(['phrase', 'pattern', 'motif', 'opening', 'ending', 'simile']),
    description: z.string(),
    severity: z.enum(['warning', 'error']),
    examples: z.array(z.string()),
  })),
});

/**
 * LLM-based self-repetition detection rule
 * Detects excessive repetition within a chapter and across chapters
 */
export function createSelfRepetitionRule(llmClient: LLMClient): AsyncComplianceRule {
  const rule = new SelfRepetitionRule(llmClient);
  return {
    name: rule.name,
    check: (text: string, chapterContext?: ChapterContext) => rule.check(text, chapterContext),
  };
}

export class SelfRepetitionRule implements AsyncComplianceRule {
  readonly name = 'self_repetition';
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  async check(text: string, chapterContext?: ChapterContext): Promise<Violation[]> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(text, chapterContext);

    const response = await this.llmClient.completeStructured(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      RepetitionReportSchema,
      { temperature: 1.0 },
    );

    return this.parseResponse(response.data, text);
  }

  private buildSystemPrompt(): string {
    return `あなたは文章の反復パターンを検出する専門家です。
以下の観点で過剰な反復を検出してください:

## 章内反復
- 同一フレーズの3回以上の使用（意図的なリフレインを除く）
- 同一展開パターンの繰り返し（例: 毎段落が「動作→内省→風景」の同じ順序）
- 比喩表現の再利用（同じ比喩を別の箇所で使い回す）
- モチーフの磨耗（同じイメージや象徴の過度な繰り返し）

## 章間反復（前章テキストが提供された場合）
- 前章と同じ冒頭パターン（例: 両章とも風景描写で始まる）
- 前章と同じ結末パターン（例: 両章とも独白で終わる）
- 前章の比喩の再利用
- 前章と同じ感情表現の繰り返し

意図的な文学的リフレイン（テーマ的に意味のある繰り返し）は検出対象外です。
3回以上の同一フレーズはerror、それ以外はwarningとしてください。`;
  }

  private buildUserPrompt(text: string, chapterContext?: ChapterContext): string {
    const parts: string[] = [];

    if (chapterContext && chapterContext.previousChapterTexts.length > 0) {
      // Pass full previous chapter texts (limit to last 5 for token efficiency)
      const previousTexts = chapterContext.previousChapterTexts.slice(-5);
      for (let i = 0; i < previousTexts.length; i++) {
        parts.push(`【前章${i + 1}】`);
        parts.push(previousTexts[i]);
        parts.push('');
      }
    }

    parts.push('【現在の章（検査対象）】');
    parts.push(text);

    return parts.join('\n');
  }

  private parseResponse(raw: unknown, text: string): Violation[] {
    const parsed = RepetitionReportSchema.safeParse(raw);
    if (!parsed.success) return [];
    const report: RepetitionReport = parsed.data;

    if (!Array.isArray(report.repetitions)) {
      return [];
    }

    return report.repetitions.map((r) => {
      // Try to find position of first example in text
      const firstExample = r.examples[0] || '';
      const start = text.indexOf(firstExample);
      const position = start >= 0
        ? { start, end: start + firstExample.length }
        : { start: 0, end: 0 };

      return {
        type: 'self_repetition' as const,
        position,
        context: r.examples.join(' / '),
        rule: `${r.type}: ${r.description}`,
        severity: r.severity,
      };
    });
  }
}
