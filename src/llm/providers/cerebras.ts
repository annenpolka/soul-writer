import { CerebrasClient } from '../cerebras.js';
import type { LLMProviderDefinition } from './types.js';

export const CEREBRAS_DEFAULT_MODEL = 'zai-glm-4.7';

export const cerebrasProvider: LLMProviderDefinition = {
  id: 'cerebras',
  displayName: 'Cerebras',
  defaultModel: CEREBRAS_DEFAULT_MODEL,

  resolveConfig({ env, overrides }) {
    const apiKey = overrides.apiKey ?? env.CEREBRAS_API_KEY;
    if (!apiKey) {
      throw new Error('CEREBRAS_API_KEY is required for cerebras provider');
    }

    return {
      provider: 'cerebras',
      model: overrides.model ?? env.CEREBRAS_MODEL ?? CEREBRAS_DEFAULT_MODEL,
      apiKey,
    };
  },

  async createClient(config) {
    if (!config.apiKey) {
      throw new Error('CEREBRAS_API_KEY is required for cerebras provider');
    }
    return new CerebrasClient({
      apiKey: config.apiKey,
      model: config.model,
    });
  },
};
