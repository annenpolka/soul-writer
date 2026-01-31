import type { PromptConfig } from '../schemas/prompt-config.js';
import type { SoulText } from '../soul/manager.js';

function resolveDotPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function resolveSoulRef(
  ref: string,
  promptConfig: PromptConfig,
  soulText: SoulText,
): unknown {
  if (ref.startsWith('soultext://')) {
    const path = ref.slice('soultext://'.length);
    return resolveDotPath(soulText, path);
  }

  if (!ref.startsWith('soul://')) {
    throw new Error(`Invalid protocol in ref: ${ref}. Expected soul:// or soultext://`);
  }

  const path = ref.slice('soul://'.length);
  const dotIndex = path.indexOf('.');

  if (dotIndex === -1) {
    // Top-level key in promptConfig
    return resolveDotPath(promptConfig, path);
  }

  const firstKey = path.slice(0, dotIndex);
  const rest = path.slice(dotIndex + 1);

  // Check if firstKey is an agent name
  if (promptConfig.agents?.[firstKey]) {
    return resolveDotPath(promptConfig.agents[firstKey], rest);
  }

  // Otherwise resolve from top-level promptConfig
  return resolveDotPath(promptConfig, path);
}
