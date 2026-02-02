import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import { buildPrompt } from '../template/composer.js';
import {
  FacilitationResultSchema,
  type CollaborationState,
  type CollaborationAction,
  type FacilitationResult,
  type FeedbackAction,
} from './types.js';

const SUBMIT_FACILITATION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_facilitation',
    description: 'モデレーターのファシリテーション結果を提出する',
    parameters: {
      type: 'object',
      properties: {
        nextPhase: { type: 'string' },
        assignments: { type: 'object', additionalProperties: { type: 'string' } },
        summary: { type: 'string' },
        shouldTerminate: { type: 'boolean' },
        consensusScore: { type: 'number' },
        continueRounds: { type: 'number' },
      },
      required: ['nextPhase', 'assignments', 'summary', 'shouldTerminate', 'consensusScore'],
      additionalProperties: false,
    },
    strict: true,
  },
};

interface WriterInfo {
  id: string;
  name: string;
  focusCategories?: string[];
}

export class ModeratorAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  private static readonly FACILITATE_MAX_RETRIES = 2;

  async facilitateRound(
    state: CollaborationState,
    actions: CollaborationAction[],
    writers: WriterInfo[],
  ): Promise<FacilitationResult> {
    const context = this.buildFacilitationContext(state, actions, writers);
    const { system, user } = buildPrompt('moderator', context);
    assertToolCallingClient(this.llmClient);

    for (let attempt = 0; attempt <= ModeratorAgent.FACILITATE_MAX_RETRIES; attempt++) {
      try {
        const response = await this.llmClient.completeWithTools(
          system,
          user,
          [SUBMIT_FACILITATION_TOOL],
          {
            toolChoice: { type: 'function', function: { name: 'submit_facilitation' } },
            temperature: 0.3,
          },
        );

        return this.parseToolResponse(response);
      } catch {
        if (attempt === ModeratorAgent.FACILITATE_MAX_RETRIES) {
          // フォールバック: 安全なデフォルト結果で続行
          return {
            nextPhase: state.currentPhase,
            assignments: {},
            summary: '（モデレーター応答の解析に失敗。現状維持で続行）',
            shouldTerminate: false,
            consensusScore: 0,
            continueRounds: 0,
          };
        }
      }
    }

    // TypeScript requires this (unreachable)
    throw new Error('Unreachable');
  }

  async composeFinal(
    drafts: Record<string, string>,
    feedback: FeedbackAction[],
  ): Promise<{ text: string; tokensUsed: number }> {
    const tokensBefore = this.llmClient.getTotalTokens();

    const draftEntries = Object.entries(drafts)
      .map(([section, text]) => `## ${section}\n${text}`)
      .join('\n\n');

    const feedbackSummary = feedback
      .map((f) => `- ${f.writerId} → ${f.targetWriterId}: ${f.feedback}`)
      .join('\n');

    // Extract soultext excerpt as style reference (~2000 chars)
    const soultextExcerpt = this.extractSoultextExcerpt();

    const systemPrompt = [
      'あなたは小説の編集者です。複数のWriterが執筆したセクション草稿を、フィードバックを踏まえて一貫性のある作品に統合してください。',
      '',
      '## 統合の指針',
      '- 各セクションの接続を自然にする',
      '- 文体・視点・トーンの一貫性を保つ',
      '- フィードバックの指摘を反映する',
      '- 各セクションの最も優れた描写を保持し、平坦化しないこと',
      '- 短文の連続ではなく、短文と長文のリズム変化を維持すること',
      '- 対話シーンが含まれている場合は積極的に残すこと',
      '- 統合したテキスト本文のみを返してください（メタ情報不要）',
      ...(soultextExcerpt ? [
        '',
        '## 参考文体（原典より）',
        '以下の文体に寄せて統合してください:',
        soultextExcerpt,
      ] : []),
    ].join('\n');

    const userPrompt = [
      '## セクション草稿',
      draftEntries,
      '',
      feedbackSummary ? `## フィードバック\n${feedbackSummary}` : '',
      '',
      '上記を統合した最終テキストを出力してください。',
    ].join('\n');

    const text = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.4,
    });

    const tokensUsed = this.llmClient.getTotalTokens() - tokensBefore;

    return { text, tokensUsed };
  }

  private buildFacilitationContext(
    state: CollaborationState,
    actions: CollaborationAction[],
    writers: WriterInfo[],
  ): Record<string, unknown> {
    const soulName = this.soulText.constitution?.meta?.soul_name ?? 'ソウルテキスト';

    const writerEntries = writers.map((w) => ({
      id: w.id,
      name: w.name,
      focusCategories: (w.focusCategories ?? []).join(', '),
    }));

    const actionEntries = actions.map((a) => ({
      type: a.type,
      writerId: a.writerId,
      summary: this.summarizeAction(a),
    }));

    const sectionAssignmentEntries = Object.entries(state.sectionAssignments).map(
      ([section, writerId]) => ({ section, writerId }),
    );

    const currentDraftEntries = Object.entries(state.currentDrafts).map(
      ([section, text]) => ({ section, text }),
    );

    // Constitution summary
    const constitution = this.soulText.constitution;
    const forbiddenWords = constitution?.universal?.vocabulary?.forbidden_words ?? [];
    const constitutionSummaryText = forbiddenWords.length > 0
      ? `禁止語彙: ${forbiddenWords.slice(0, 5).join(', ')}...`
      : '';

    // Voice entries from world bible characters (Record<string, Character>)
    const characters = this.soulText.worldBible?.characters ?? {};
    const voiceEntries = Object.entries(characters).map(([name, c]) => ({
      name,
      style: c.speech_pattern ?? (c.traits as string[] | undefined)?.join(', ') ?? '',
    }));

    // Anti-soul compact
    const antiSoul = this.soulText.antiSoul;
    const allAntiExamples = Object.values(antiSoul?.categories ?? {}).flat();
    const antiSoulCompactEntries = allAntiExamples.slice(0, 3).map((e) => ({
      text: typeof e === 'string' ? e : (e as any).text ?? '',
    }));

    return {
      soulName,
      writerEntries,
      roundNumber: state.rounds.length + 1,
      currentPhase: state.currentPhase,
      actionEntries,
      sectionAssignmentEntries: sectionAssignmentEntries.length > 0 ? sectionAssignmentEntries : undefined,
      currentDraftEntries: currentDraftEntries.length > 0 ? currentDraftEntries : undefined,
      constitutionSummaryText,
      voiceEntries: voiceEntries.length > 0 ? voiceEntries : undefined,
      antiSoulCompactEntries: antiSoulCompactEntries?.length ? antiSoulCompactEntries : undefined,
    };
  }

  private extractSoultextExcerpt(): string | undefined {
    const raw = this.soulText.rawSoultext;
    if (!raw) return undefined;

    // Extract representative fragments: look for dialogue and introspection sections
    const lines = raw.split('\n');
    const excerpts: string[] = [];
    let currentChunk: string[] = [];
    let collecting = false;

    for (const line of lines) {
      // Look for lines with dialogue markers or narrative content
      if (line.includes('「') || line.includes('」') || (line.length > 20 && !line.startsWith('#'))) {
        collecting = true;
        currentChunk.push(line);
        if (currentChunk.join('\n').length > 600) {
          excerpts.push(currentChunk.join('\n'));
          currentChunk = [];
          collecting = false;
          if (excerpts.join('\n').length > 1800) break;
        }
      } else if (collecting && line.trim() === '') {
        if (currentChunk.length > 3) {
          excerpts.push(currentChunk.join('\n'));
          currentChunk = [];
          collecting = false;
          if (excerpts.join('\n').length > 1800) break;
        }
      } else {
        if (currentChunk.length > 0 && currentChunk.join('\n').length > 100) {
          excerpts.push(currentChunk.join('\n'));
        }
        currentChunk = [];
        collecting = false;
      }
    }

    if (currentChunk.length > 0 && currentChunk.join('\n').length > 100) {
      excerpts.push(currentChunk.join('\n'));
    }

    const result = excerpts.slice(0, 3).join('\n\n---\n\n');
    return result.length > 0 ? result.slice(0, 2000) : undefined;
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

  private parseToolResponse(response: ToolCallResponse): FacilitationResult {
    const parsed = parseToolArguments<unknown>(response, 'submit_facilitation');
    return FacilitationResultSchema.parse(parsed);
  }
}
