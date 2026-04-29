import type { LLMClient } from './types.js';
import {
  resolveLLMConfig,
  type LLMConfigOverrides,
  type ResolvedProviderConfig,
} from './config.js';
import type { CodexReasoningEffort } from './codex/types.js';
import { defaultLLMProviderRegistry, type LLMProviderRegistry } from './providers/index.js';

export type LLMProvider = string;

export interface ProviderConfig extends LLMConfigOverrides {
  provider: LLMProvider;
  env?: NodeJS.ProcessEnv;
  cerebrasApiKey?: string;
  cerebrasModel?: string;
  codexModel?: string;
  codexReasoningEffort?: CodexReasoningEffort;
  openAICompatibleApiKey?: string;
  openAICompatibleBaseUrl?: string;
  openAICompatibleModel?: string;
}

export async function createLLMClient(
  config: ProviderConfig,
  registry: LLMProviderRegistry = defaultLLMProviderRegistry,
): Promise<LLMClient> {
  const env = buildLegacyEnv(config);
  const overrides = buildLegacyOverrides(config);
  const resolved = resolveLLMConfig(env, overrides, registry);
  return createLLMClientFromResolvedConfig(resolved, registry);
}

export async function createLLMClientFromResolvedConfig(
  config: ResolvedProviderConfig,
  registry: LLMProviderRegistry = defaultLLMProviderRegistry,
): Promise<LLMClient> {
  return registry.get(config.provider).createClient(config);
}

function buildLegacyOverrides(config: ProviderConfig): LLMConfigOverrides {
  return {
    provider: config.provider,
    model: config.model ?? modelFromLegacyConfig(config),
    reasoningEffort: config.reasoningEffort ?? config.codexReasoningEffort,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  };
}

function modelFromLegacyConfig(config: ProviderConfig): string | undefined {
  if (config.provider === 'cerebras') return config.cerebrasModel;
  if (config.provider === 'codex') return config.codexModel;
  if (config.provider === 'openai-compatible') return config.openAICompatibleModel;
  return undefined;
}

function buildLegacyEnv(config: ProviderConfig): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...(config.env ?? process.env) };
  if (config.cerebrasApiKey !== undefined) env.CEREBRAS_API_KEY = config.cerebrasApiKey;
  if (config.cerebrasModel !== undefined) env.CEREBRAS_MODEL = config.cerebrasModel;
  if (config.codexModel !== undefined) env.CODEX_MODEL = config.codexModel;
  if (config.codexReasoningEffort !== undefined) env.CODEX_REASONING_EFFORT = config.codexReasoningEffort;
  if (config.openAICompatibleApiKey !== undefined) env.OPENAI_COMPAT_API_KEY = config.openAICompatibleApiKey;
  if (config.openAICompatibleBaseUrl !== undefined) env.OPENAI_COMPAT_BASE_URL = config.openAICompatibleBaseUrl;
  if (config.openAICompatibleModel !== undefined) env.OPENAI_COMPAT_MODEL = config.openAICompatibleModel;
  return env;
}
