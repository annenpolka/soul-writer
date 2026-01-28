import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { CorrectionResult, Violation } from './types.js';

/**
 * CorrectorAgent fixes compliance violations in text using LLM
 */
export class CorrectorAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  /**
   * Correct text by fixing specified violations
   */
  async correct(text: string, violations: Violation[]): Promise<CorrectionResult> {
    const { systemPrompt, userPrompt } = this.buildPrompts(text, violations);
    const correctedText = await this.llmClient.complete(systemPrompt, userPrompt);
    const tokensUsed = this.llmClient.getTotalTokens();

    return {
      correctedText,
      tokensUsed,
    };
  }

  private buildPrompts(
    text: string,
    violations: Violation[]
  ): { systemPrompt: string; userPrompt: string } {
    const violationList = violations
      .map(
        (v, i) =>
          `${i + 1}. [${v.type}] "${v.context}" - ${v.rule} (severity: ${v.severity})`
      )
      .join('\n');

    const constitution = this.soulText.constitution;

    const systemPrompt = `あなたは文章矯正エージェントです。以下のルールに従って文章を修正してください。

## 憲法のルール

### 禁止語彙
${constitution.vocabulary.forbidden_words.join(', ')}

### 禁止直喩
${constitution.rhetoric.forbidden_similes.join(', ')}

### 特殊記号の使用法
記号「${constitution.vocabulary.special_marks.mark}」は以下の形式でのみ使用可能：
${constitution.vocabulary.special_marks.forms.join(', ')}

## 指示
1. 上記の違反をすべて修正してください
2. 文章の意味と流れを維持してください
3. ソウルテキストの文体を維持してください
4. 修正後の文章のみを出力してください（説明は不要）`;

    const userPrompt = `## 修正対象の文章
${text}

## 検出された違反
${violationList}`;

    return { systemPrompt, userPrompt };
  }
}
