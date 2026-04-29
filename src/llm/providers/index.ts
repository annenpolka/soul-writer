import { cerebrasProvider } from './cerebras.js';
import { codexProvider } from './codex.js';
import { openAICompatibleProvider } from './openai-compatible.js';
import { createLLMProviderRegistry } from './types.js';

export { cerebrasProvider } from './cerebras.js';
export { codexProvider } from './codex.js';
export { openAICompatibleProvider, OpenAICompatibleClient } from './openai-compatible.js';
export type { LLMProviderDefinition, LLMProviderRegistry } from './types.js';
export { createLLMProviderRegistry } from './types.js';

export const defaultLLMProviderRegistry = createLLMProviderRegistry([
  cerebrasProvider,
  codexProvider,
  openAICompatibleProvider,
]);
