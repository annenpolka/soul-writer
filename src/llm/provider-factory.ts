import type { LLMClient } from './types.js';
import type { CodexReasoningEffort } from './codex/types.js';

export type LLMProvider = 'cerebras' | 'codex';

export interface ProviderConfig {
  provider: LLMProvider;
  cerebrasApiKey?: string;
  cerebrasModel?: string;
  codexModel?: string;
  codexReasoningEffort?: CodexReasoningEffort;
}

export async function createLLMClient(config: ProviderConfig): Promise<LLMClient> {
  switch (config.provider) {
    case 'cerebras': {
      if (!config.cerebrasApiKey) {
        throw new Error('CEREBRAS_API_KEY is required for cerebras provider');
      }
      const { CerebrasClient } = await import('./cerebras.js');
      return new CerebrasClient({
        apiKey: config.cerebrasApiKey,
        model: config.cerebrasModel ?? 'zai-glm-4.7',
      });
    }
    case 'codex': {
      const { CodexClient } = await import('./codex/codex-client.js');
      const { createFileTokenStore } = await import('./codex/token-store.js');
      return new CodexClient({
        model: config.codexModel ?? 'gpt-5.2',
        reasoningEffort: config.codexReasoningEffort,
        tokenStore: createFileTokenStore(),
      });
    }
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
