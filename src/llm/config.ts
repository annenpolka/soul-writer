import { defaultLLMProviderRegistry } from './providers/index.js';
import type { LLMProviderRegistry } from './providers/types.js';

export interface LLMConfigOverrides {
  provider?: string;
  model?: string;
  reasoningEffort?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ProviderConfigInput {
  env: NodeJS.ProcessEnv;
  overrides: LLMConfigOverrides;
}

export interface ResolvedProviderConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  reasoningEffort?: string;
  options?: Record<string, unknown>;
}

export function resolveLLMConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: LLMConfigOverrides = {},
  registry: LLMProviderRegistry = defaultLLMProviderRegistry,
): ResolvedProviderConfig {
  const providerId = overrides.provider ?? env.LLM_PROVIDER ?? 'cerebras';
  const provider = registry.get(providerId);
  return provider.resolveConfig({ env, overrides: { ...overrides, provider: providerId } });
}
