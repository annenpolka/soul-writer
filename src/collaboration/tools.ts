import type { ToolDefinition } from '../llm/types.js';
import type { CollaborationAction } from './types.js';

export const COLLABORATION_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'submit_proposal',
      description: 'セクションや章の方向性・構成について提案を提出する',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '提案内容' },
          targetSection: { type: 'string', description: '対象セクション名' },
        },
        required: ['content'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'give_feedback',
      description: '他のWriterの提案や草稿に対してフィードバックを送信する',
      parameters: {
        type: 'object',
        properties: {
          targetWriterId: { type: 'string', description: 'フィードバック対象のWriter ID' },
          feedback: { type: 'string', description: 'フィードバック内容' },
          sentiment: {
            type: 'string',
            enum: ['agree', 'disagree', 'suggest_revision', 'challenge'],
            description: '賛成・反対・修正提案・根本的異議',
          },
          counterProposal: {
            type: 'string',
            description: '代替案。challengeの場合は必須で具体的に記述すること。それ以外のsentimentでは空文字列可',
          },
        },
        required: ['targetWriterId', 'feedback', 'sentiment', 'counterProposal'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_draft',
      description: '担当セクションの草稿テキストを提出する',
      parameters: {
        type: 'object',
        properties: {
          section: { type: 'string', description: 'セクション名' },
          text: { type: 'string', description: '草稿テキスト本文' },
        },
        required: ['section', 'text'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'volunteer_section',
      description: 'セクションの執筆担当に立候補する',
      parameters: {
        type: 'object',
        properties: {
          section: { type: 'string', description: '担当したいセクション名' },
          reason: { type: 'string', description: '立候補の理由' },
        },
        required: ['section', 'reason'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return COLLABORATION_TOOLS.find((t) => t.function.name === name);
}

export function parseToolCallToAction(
  writerId: string,
  toolName: string,
  argumentsJson: string,
): CollaborationAction {
  const args = JSON.parse(argumentsJson);

  switch (toolName) {
    case 'submit_proposal':
      return {
        type: 'proposal',
        writerId,
        content: args.content,
        targetSection: args.targetSection,
      };
    case 'give_feedback':
      return {
        type: 'feedback',
        writerId,
        targetWriterId: args.targetWriterId,
        feedback: args.feedback,
        sentiment: args.sentiment,
        ...(args.counterProposal && args.counterProposal !== '' ? { counterProposal: args.counterProposal } : {}),
      };
    case 'submit_draft':
      return {
        type: 'draft',
        writerId,
        section: args.section,
        text: args.text,
      };
    case 'volunteer_section':
      return {
        type: 'volunteer',
        writerId,
        section: args.section,
        reason: args.reason,
      };
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
