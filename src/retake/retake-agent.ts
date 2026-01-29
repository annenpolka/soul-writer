import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';

export interface RetakeResult {
  retakenText: string;
  tokensUsed: number;
}

/**
 * RetakeAgent rewrites text at the style/character/plot level.
 * Unlike CorrectorAgent which fixes surface violations (forbidden words),
 * RetakeAgent addresses deeper issues: wrong voice, character misrepresentation,
 * plot fabrication, and rhythm problems.
 */
export class RetakeAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  async retake(originalText: string, feedback: string): Promise<RetakeResult> {
    const tokensBefore = this.llmClient.getTotalTokens();
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(originalText, feedback);

    const retakenText = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.6,
    });

    return {
      retakenText,
      tokensUsed: this.llmClient.getTotalTokens() - tokensBefore,
    };
  }

  private buildSystemPrompt(): string {
    const meta = this.soulText.constitution.meta;
    const constitution = this.soulText.constitution;
    const parts: string[] = [];

    parts.push(`あなたは「${meta.soul_name}」のリテイク専門家です。`);
    parts.push('提示されたテキストを、フィードバックに基づいて原作により忠実な形に書き直してください。');
    parts.push('');
    parts.push('【絶対ルール】');
    parts.push('- 一人称は「わたし」（ひらがな）のみ');
    parts.push('- 御鐘透心の一人称視点を厳守');
    parts.push('- 冷徹・簡潔・乾いた語り口');
    parts.push('- 原作にない設定やキャラクターを捏造しない');
    parts.push(`- リズム: ${constitution.sentence_structure.rhythm_pattern}`);
    parts.push(`- 禁止語彙: ${constitution.vocabulary.forbidden_words.join(', ')}`);
    parts.push(`- 禁止比喩: ${constitution.rhetoric.forbidden_similes.join(', ')}`);
    parts.push('');

    // Character voice reference
    parts.push('## キャラクター対話スタイル');
    for (const [charName, style] of Object.entries(constitution.narrative.dialogue_style_by_character)) {
      parts.push(`- ${charName}: ${style}`);
    }
    parts.push('');

    // Reference fragments
    parts.push('## 原作の文体参考');
    let count = 0;
    for (const [category, fragments] of this.soulText.fragments) {
      if (fragments.length > 0 && count < 3) {
        parts.push(`### ${category}`);
        parts.push('```');
        parts.push(fragments[0].text);
        parts.push('```');
        count++;
      }
    }

    return parts.join('\n');
  }

  private buildUserPrompt(originalText: string, feedback: string): string {
    const parts: string[] = [];
    parts.push('## 書き直し対象テキスト');
    parts.push('```');
    parts.push(originalText);
    parts.push('```');
    parts.push('');
    parts.push('## フィードバック（修正すべき問題）');
    parts.push(feedback);
    parts.push('');
    parts.push('上記のフィードバックに基づいて、テキスト全体を原作の文体に忠実に書き直してください。');
    parts.push('元のプロット・シーン展開は維持しつつ、文体・語り口・キャラクター描写を改善してください。');
    return parts.join('\n');
  }
}
