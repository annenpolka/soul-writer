import { z } from 'zod';
import type { LLMClient } from '../../llm/types.js';
import type { Violation, ChapterContext } from '../../agents/types.js';
import type { AsyncComplianceRule } from './async-rule.js';

interface VariationIssue {
  type: 'emotional_arc_similarity' | 'beat_structure_similarity' | 'dramaturgy_mismatch';
  description: string;
  severity: 'warning' | 'error';
  suggestion: string;
}

interface VariationReport {
  issues: VariationIssue[];
}

const VariationReportSchema = z.object({
  issues: z.array(z.object({
    type: z.enum(['emotional_arc_similarity', 'beat_structure_similarity', 'dramaturgy_mismatch']),
    description: z.string(),
    severity: z.enum(['warning', 'error']),
    suggestion: z.string(),
  })),
});

export function createChapterVariationRule(llmClient: LLMClient): AsyncComplianceRule {
  return {
    name: 'chapter_variation',
    check: async (text: string, chapterContext?: ChapterContext): Promise<Violation[]> => {
      // Skip for first chapter (no previous chapter to compare)
      if (!chapterContext || chapterContext.previousChapterTexts.length === 0) {
        return [];
      }

      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(text, chapterContext);

      const response = await llmClient.completeStructured(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        VariationReportSchema,
        { temperature: 1.0 },
      );

      return parseResponse(response.data);
    },
  };
}

function buildSystemPrompt(): string {
  return `あなたは小説の章間変奏を評価する専門家です。
前章と現在の章を比較し、以下の観点で変奏不足を検出してください:

## 検出対象
1. **感情弧の同一性** (emotional_arc_similarity):
   - 両章の感情遷移パターンが類似していないか
   - 例: 両章とも「疎外→怒り→無力感→諦観」の同一パターン

2. **ビート構成の同一性** (beat_structure_similarity):
   - 章内の出来事の展開構造が前章と類似していないか
   - 例: 両章とも「都市空間→システム異常→観察→内省→未解決」

3. **ドラマトゥルギー不一致** (dramaturgy_mismatch):
   - 章が新しい体験を提供しているか
   - 前章と同じ「起動装置」（対峙、発見、喪失等）を使っていないか

## 判定基準
- 感情の遷移パターンが前章と70%以上類似 → warning
- ビート構成が前章とほぼ同一 → warning
- 2章連続で同種の問題が検出される場合 → error
- 意図的な文学的反復（テーマ的に意味のある繰り返し）は問題なし

問題がなければ issues を空配列にしてください。`;
}

function buildUserPrompt(text: string, chapterContext: ChapterContext): string {
  const parts: string[] = [];
  // Only compare with the most recent previous chapter
  const lastChapter = chapterContext.previousChapterTexts[chapterContext.previousChapterTexts.length - 1];
  parts.push('【前章】');
  parts.push(lastChapter);
  parts.push('');
  parts.push('【現在の章（検査対象）】');
  parts.push(text);
  return parts.join('\n');
}

function parseResponse(raw: unknown): Violation[] {
  const parsed = VariationReportSchema.safeParse(raw);
  if (!parsed.success) return [];
  const report: VariationReport = parsed.data;

  if (!Array.isArray(report.issues)) {
    return [];
  }

  return report.issues.map((issue) => ({
    type: 'chapter_variation' as const,
    position: { start: 0, end: 0 },
    context: issue.suggestion,
    rule: `${issue.type}: ${issue.description}`,
    severity: issue.severity,
  }));
}
