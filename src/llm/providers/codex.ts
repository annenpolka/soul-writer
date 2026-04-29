import { CodexClient } from '../codex/codex-client.js';
import { createFileTokenStore } from '../codex/token-store.js';
import type { CodexReasoningEffort } from '../codex/types.js';
import type { LLMProviderDefinition } from './types.js';

export const CODEX_DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_REASONING_EFFORT: CodexReasoningEffort = 'medium';
const VALID_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;

function normalizeReasoningEffort(raw?: string): CodexReasoningEffort {
  const normalized = raw?.trim().toLowerCase();
  return normalized && (VALID_REASONING_EFFORTS as readonly string[]).includes(normalized)
    ? (normalized as CodexReasoningEffort)
    : DEFAULT_REASONING_EFFORT;
}

export const codexProvider: LLMProviderDefinition = {
  id: 'codex',
  displayName: 'OpenAI Codex',
  defaultModel: CODEX_DEFAULT_MODEL,

  resolveConfig({ env, overrides }) {
    return {
      provider: 'codex',
      model: overrides.model ?? env.CODEX_MODEL ?? CODEX_DEFAULT_MODEL,
      reasoningEffort: normalizeReasoningEffort(overrides.reasoningEffort ?? env.CODEX_REASONING_EFFORT),
    };
  },

  async createClient(config) {
    return new CodexClient({
      model: config.model,
      reasoningEffort: config.reasoningEffort as CodexReasoningEffort | undefined,
      tokenStore: createFileTokenStore(),
    });
  },
};
