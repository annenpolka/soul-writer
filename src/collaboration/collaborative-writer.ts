import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { WriterConfig } from '../agents/types.js';
import { COLLABORATION_TOOLS, parseToolCallToAction } from './tools.js';
import type { CollaborationAction, CollaborationState } from './types.js';

export class CollaborativeWriter {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private config: WriterConfig;

  constructor(llmClient: LLMClient, soulText: SoulText, config: WriterConfig) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.config = config;
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.personaName ?? this.config.id;
  }

  get focusCategories(): string[] | undefined {
    return this.config.focusCategories;
  }

  private static readonly PARTICIPATE_MAX_RETRIES = 2;

  async participate(
    state: CollaborationState,
    prompt: string,
  ): Promise<CollaborationAction[]> {
    if (!this.llmClient.completeWithTools) {
      throw new Error('LLMClient does not support tool calling');
    }

    const systemPrompt = this.buildSystemPrompt(state);
    const userPrompt = this.buildUserPrompt(state, prompt);

    // draftingフェーズではsubmit_draftのみに制限して確実に草稿を生成させる
    const tools = state.currentPhase === 'drafting'
      ? COLLABORATION_TOOLS.filter((t) => t.function.name === 'submit_draft')
      : COLLABORATION_TOOLS;

    for (let attempt = 0; attempt <= CollaborativeWriter.PARTICIPATE_MAX_RETRIES; attempt++) {
      try {
        const response = await this.llmClient.completeWithTools(
          systemPrompt,
          userPrompt,
          tools,
          {
            toolChoice: 'required',
            temperature: this.config.temperature,
            topP: this.config.topP,
          },
        );

        return response.toolCalls.map((tc) =>
          parseToolCallToAction(this.config.id, tc.function.name, tc.function.arguments),
        );
      } catch {
        if (attempt === CollaborativeWriter.PARTICIPATE_MAX_RETRIES) {
          // フォールバック: セッションを殺さないよう空の提案を返す
          return [{
            type: 'proposal' as const,
            writerId: this.config.id,
            content: '（応答生成に失敗しました）',
          }];
        }
      }
    }

    // TypeScript requires this (unreachable)
    return [];
  }

  private buildSystemPrompt(state: CollaborationState): string {
    const lines: string[] = [];

    lines.push(`あなたは共作プロジェクトに参加するWriter「${this.name}」です。`);
    lines.push('\nあなたの担当軸で貢献しつつ、文体は必ず原典に準拠すること。');

    if (this.config.personaDirective) {
      lines.push(`\n## あなたの役割\n${this.config.personaDirective}`);
    }

    // Add soultext excerpt as style reference
    const rawSoultext = this.soulText.rawSoultext;
    if (rawSoultext) {
      const excerpt = rawSoultext.slice(0, 1500);
      lines.push(`\n## 原典文体の参考\n以下は原典の一部です。この文体に寄せて執筆してください:\n${excerpt}`);
    }

    if (this.config.focusCategories?.length) {
      lines.push(`\n## 得意カテゴリ\n${this.config.focusCategories.join(', ')}`);
    }

    lines.push(`\n## 現在のフェーズ: ${state.currentPhase}`);
    lines.push('\n## 利用可能なアクション');
    lines.push('- submit_proposal: セクションの方向性を提案');
    lines.push('- give_feedback: 他Writerの提案や草稿にフィードバック');
    lines.push('- submit_draft: 担当セクションの草稿を提出');
    lines.push('- volunteer_section: セクション担当に立候補');
    lines.push('\n必ずツールを使ってアクションを返してください。');

    return lines.join('\n');
  }

  private buildUserPrompt(state: CollaborationState, prompt: string): string {
    const lines: string[] = [];

    lines.push(`## 作品のプロンプト\n${prompt}`);

    if (state.rounds.length > 0) {
      const lastRound = state.rounds[state.rounds.length - 1];
      lines.push(`\n## 直前のラウンド要約\n${lastRound.moderatorSummary}`);

      if (lastRound.actions.length > 0) {
        lines.push('\n## 直前のアクション');
        for (const a of lastRound.actions) {
          lines.push(`- [${a.type}] ${a.writerId}: ${this.summarizeAction(a)}`);
        }
      }
    }

    const assignments = Object.entries(state.sectionAssignments);
    if (assignments.length > 0) {
      lines.push('\n## 担当割り振り');
      for (const [section, writerId] of assignments) {
        lines.push(`- ${section}: ${writerId}`);
      }
    }

    const drafts = Object.entries(state.currentDrafts);
    if (drafts.length > 0) {
      lines.push('\n## 現在の草稿');
      for (const [section, text] of drafts) {
        lines.push(`### ${section}\n${text.slice(0, 500)}`);
      }
    }

    lines.push(`\nフェーズ「${state.currentPhase}」として適切なアクションをツールで実行してください。`);

    return lines.join('\n');
  }

  private summarizeAction(action: CollaborationAction): string {
    switch (action.type) {
      case 'proposal':
        return action.content;
      case 'feedback':
        return `→${action.targetWriterId}: ${action.feedback}`;
      case 'draft':
        return `[${action.section}] ${action.text}`;
      case 'volunteer':
        return `${action.section}に立候補: ${action.reason}`;
    }
  }
}
