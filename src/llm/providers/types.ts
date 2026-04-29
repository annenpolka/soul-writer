import type { LLMClient } from '../types.js';
import type { ProviderConfigInput, ResolvedProviderConfig } from '../config.js';

export interface LLMProviderDefinition {
  id: string;
  displayName: string;
  defaultModel: string;
  resolveConfig(input: ProviderConfigInput): ResolvedProviderConfig;
  createClient(config: ResolvedProviderConfig): Promise<LLMClient>;
}

export interface LLMProviderRegistry {
  register(definition: LLMProviderDefinition): void;
  get(id: string): LLMProviderDefinition;
  list(): LLMProviderDefinition[];
}

export function createLLMProviderRegistry(
  definitions: LLMProviderDefinition[] = [],
): LLMProviderRegistry {
  const providers = new Map<string, LLMProviderDefinition>();

  const registry: LLMProviderRegistry = {
    register(definition) {
      if (providers.has(definition.id)) {
        throw new Error(`LLM provider "${definition.id}" is already registered`);
      }
      providers.set(definition.id, definition);
    },

    get(id) {
      const definition = providers.get(id);
      if (!definition) {
        const available = Array.from(providers.keys()).sort().join(', ');
        throw new Error(`Unknown LLM provider: ${id}. Available providers: ${available}`);
      }
      return definition;
    },

    list() {
      return Array.from(providers.values());
    },
  };

  for (const definition of definitions) {
    registry.register(definition);
  }

  return registry;
}
