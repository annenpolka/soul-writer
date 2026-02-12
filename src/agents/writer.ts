import { DEFAULT_WRITERS, type WriterConfig, type GenerationResult, type WriterDeps, type Writer } from './types.js';
import { resolveNarrativeRules } from '../factory/narrative-rules.js';
import { buildPrompt } from '../template/composer.js';
import { buildWriterContext } from './context/writer-context.js';

export { DEFAULT_WRITERS, type WriterConfig };

/**
 * Create a functional Writer from dependencies
 */
export function createWriter(deps: WriterDeps): Writer {
  const { llmClient, soulText, config, developedCharacters, enrichedCharacters, themeContext, macGuffinContext, previousChapterReasoning } = deps;
  const narrativeRules = deps.narrativeRules ?? resolveNarrativeRules();

  return {
    generate: async (prompt: string): Promise<string> => {
      const context = buildWriterContext({
        prompt, soulText, config, narrativeRules, developedCharacters, enrichedCharacters, themeContext, macGuffinContext, previousChapterReasoning,
      });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('writer', context);
      return llmClient.complete(systemPrompt, userPrompt, {
        temperature: config.temperature,
        topP: config.topP,
      });
    },

    generateWithMetadata: async (prompt: string): Promise<GenerationResult> => {
      const tokensBefore = llmClient.getTotalTokens();
      const context = buildWriterContext({
        prompt, soulText, config, narrativeRules, developedCharacters, enrichedCharacters, themeContext, macGuffinContext, previousChapterReasoning,
      });
      const { system: systemPrompt, user: userPrompt } = buildPrompt('writer', context);
      const text = await llmClient.complete(systemPrompt, userPrompt, {
        temperature: config.temperature,
        topP: config.topP,
      });
      const tokensAfter = llmClient.getTotalTokens();
      return {
        writerId: config.id,
        text,
        tokensUsed: tokensAfter - tokensBefore,
      };
    },

    getId: () => config.id,

    getConfig: () => ({ ...config }),
  };
}

