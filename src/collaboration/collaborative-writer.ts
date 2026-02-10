import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { WriterConfig, ThemeContext, MacGuffinContext } from '../agents/types.js';
import type { EnrichedCharacter } from '../factory/character-enricher.js';
import { COLLABORATION_TOOLS, parseToolCallToAction } from './tools.js';
import type { CollaborationAction, CollaborationState } from './types.js';

// --- FP interface ---

export interface CollaborativeWriterFn {
  participate: (state: CollaborationState, prompt: string) => Promise<CollaborationAction[]>;
  id: string;
  name: string;
  focusCategories: string[] | undefined;
}

export interface CollaborativeWriterDeps {
  llmClient: LLMClient;
  soulText: SoulText;
  config: WriterConfig;
  themeContext?: ThemeContext;
  macGuffinContext?: MacGuffinContext;
  enrichedCharacters?: EnrichedCharacter[];
}

// --- Internal helpers ---

const PARTICIPATE_MAX_RETRIES = 2;

function summarizeAction(action: CollaborationAction): string {
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

function buildSystemPrompt(deps: CollaborativeWriterDeps, writerName: string, state: CollaborationState): string {
  const lines: string[] = [];

  lines.push(`あなたは共作プロジェクトに参加するWriter「${writerName}」です。`);
  lines.push('\nあなたの担当軸で貢献しつつ、文体は必ず原典に準拠すること。');

  if (deps.config.personaDirective) {
    lines.push(`\n## あなたの役割\n${deps.config.personaDirective}`);
  }

  // Add soultext excerpt as style reference
  const rawSoultext = deps.soulText.rawSoultext;
  if (rawSoultext) {
    const excerpt = rawSoultext.slice(0, 1500);
    lines.push(`\n## 原典文体の参考\n以下は原典の一部です。この文体に寄せて執筆してください:\n${excerpt}`);
  }

  if (deps.config.focusCategories?.length) {
    lines.push(`\n## 得意カテゴリ\n${deps.config.focusCategories.join(', ')}`);
  }

  // Theme context for consistent tone/emotion
  if (deps.themeContext) {
    lines.push('\n## テーマ・トーン');
    lines.push(`- 感情: ${deps.themeContext.emotion}`);
    lines.push(`- 時間軸: ${deps.themeContext.timeline}`);
    lines.push(`- 前提: ${deps.themeContext.premise}`);
    if (deps.themeContext.tone) {
      lines.push(`- 創作指針: ${deps.themeContext.tone}`);
    }
  }

  // MacGuffin context for character secrets and plot mysteries
  if (deps.macGuffinContext?.characterMacGuffins?.length) {
    lines.push('\n## キャラクターの秘密（表出サインを描写に織り込むこと）');
    for (const m of deps.macGuffinContext.characterMacGuffins) {
      lines.push(`- ${m.characterName}: ${m.surfaceSigns.join('、')}`);
    }
  }
  if (deps.macGuffinContext?.plotMacGuffins?.length) {
    lines.push('\n## 物語の謎（解決不要、雰囲気として漂わせること）');
    for (const m of deps.macGuffinContext.plotMacGuffins) {
      lines.push(`- ${m.name}: ${m.tensionQuestions.join('、')}`);
    }
  }

  // Enriched characters: physical habits, stance, dialogue samples (top 2)
  if (deps.enrichedCharacters?.length) {
    lines.push('\n## キャラクター身体性・態度（描写に織り込むこと）');
    for (const c of deps.enrichedCharacters) {
      lines.push(`### ${c.name}`);
      lines.push(`- 態度(stance): ${c.stance.type} — ${c.stance.manifestation}`);
      for (const h of c.physicalHabits) {
        lines.push(`- 身体癖: ${h.habit}（トリガー: ${h.trigger}）— ${h.sensoryDetail}`);
      }
      if (c.dialogueSamples?.length) {
        const topSamples = c.dialogueSamples.slice(0, 2);
        for (const s of topSamples) {
          lines.push(`- 台詞例: 「${s.line}」（${s.situation}）— ${s.voiceNote}`);
        }
      }
    }
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

function buildUserPrompt(state: CollaborationState, prompt: string): string {
  const lines: string[] = [];

  lines.push(`## 作品のプロンプト\n${prompt}`);

  if (state.rounds.length > 0) {
    const lastRound = state.rounds[state.rounds.length - 1];
    lines.push(`\n## 直前のラウンド要約\n${lastRound.moderatorSummary}`);

    if (lastRound.actions.length > 0) {
      lines.push('\n## 直前のアクション');
      for (const a of lastRound.actions) {
        lines.push(`- [${a.type}] ${a.writerId}: ${summarizeAction(a)}`);
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

// --- Factory function ---

export function createCollaborativeWriter(deps: CollaborativeWriterDeps): CollaborativeWriterFn {
  const { llmClient, config } = deps;
  const writerName = config.personaName ?? config.id;

  const participate = async (state: CollaborationState, prompt: string): Promise<CollaborationAction[]> => {
    if (!llmClient.completeWithTools) {
      throw new Error('LLMClient does not support tool calling');
    }

    const systemPrompt = buildSystemPrompt(deps, writerName, state);
    const userPrompt = buildUserPrompt(state, prompt);

    // draftingフェーズではsubmit_draftのみに制限して確実に草稿を生成させる
    const tools = state.currentPhase === 'drafting'
      ? COLLABORATION_TOOLS.filter((t) => t.function.name === 'submit_draft')
      : COLLABORATION_TOOLS;

    for (let attempt = 0; attempt <= PARTICIPATE_MAX_RETRIES; attempt++) {
      try {
        const response = await llmClient.completeWithTools(
          systemPrompt,
          userPrompt,
          tools,
          {
            toolChoice: 'required',
            temperature: config.temperature,
            topP: config.topP,
          },
        );

        return response.toolCalls.map((tc) =>
          parseToolCallToAction(config.id, tc.function.name, tc.function.arguments),
        );
      } catch {
        if (attempt === PARTICIPATE_MAX_RETRIES) {
          // フォールバック: セッションを殺さないよう空の提案を返す
          return [{
            type: 'proposal' as const,
            writerId: config.id,
            content: '（応答生成に失敗しました）',
          }];
        }
      }
    }

    // TypeScript requires this (unreachable)
    return [];
  };

  return {
    participate,
    id: config.id,
    name: writerName,
    focusCategories: config.focusCategories,
  };
}

