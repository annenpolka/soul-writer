import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRetakeAgent } from '../../src/retake/retake-agent.js';
import type { RetakeDeps } from '../../src/agents/types.js';
import { createMockLLMClient, createMockThemeContext } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import { resolveNarrativeRules } from '../../src/factory/narrative-rules.js';

function createMockRetakeDeps(overrides?: {
  response?: string;
  tokenCount?: number;
  themeContext?: import('../../src/agents/types.js').ThemeContext;
}): RetakeDeps {
  return {
    llmClient: createMockLLMClient(overrides?.response ?? 'retaken text', overrides?.tokenCount),
    soulText: createMockSoulText(),
    narrativeRules: resolveNarrativeRules(),
    themeContext: overrides?.themeContext,
  };
}

describe('createRetakeAgent (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a Retaker with retake method', () => {
    const deps = createMockRetakeDeps();
    const retaker = createRetakeAgent(deps);
    expect(retaker.retake).toBeInstanceOf(Function);
  });

  it('should call llmClient.complete with system and user prompts', async () => {
    const deps = createMockRetakeDeps();
    const retaker = createRetakeAgent(deps);

    await retaker.retake('original text', 'fix the voice');
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
    const [systemPrompt, userPrompt] = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(systemPrompt).toContain('リテイク');
    expect(userPrompt).toContain('original text');
    expect(userPrompt).toContain('fix the voice');
  });

  it('should return retaken text from LLM', async () => {
    const deps = createMockRetakeDeps({ response: 'improved text' });
    const retaker = createRetakeAgent(deps);

    const result = await retaker.retake('original text', 'fix the voice');
    expect(result.retakenText).toBe('improved text');
  });

  it('should return token usage', async () => {
    const deps = createMockRetakeDeps({ tokenCount: 300 });
    const retaker = createRetakeAgent(deps);

    const result = await retaker.retake('original text', 'feedback');
    expect(result.tokensUsed).toBeDefined();
  });

  it('should handle themeContext in deps', async () => {
    const themeContext = createMockThemeContext({ emotion: '渇望' });
    const deps = createMockRetakeDeps({ themeContext });
    const retaker = createRetakeAgent(deps);

    const result = await retaker.retake('original text', 'feedback');
    expect(result.retakenText).toBeDefined();

    const [systemPrompt] = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(systemPrompt).toContain('渇望');
  });

  it('should include character length constraint in user prompt', async () => {
    const deps = createMockRetakeDeps();
    const retaker = createRetakeAgent(deps);

    await retaker.retake('original text of some length', 'feedback');
    const [, userPrompt] = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(userPrompt).toContain('文字数厳守');
  });

  it('should include forbidden words in system prompt', async () => {
    const deps = createMockRetakeDeps();
    deps.soulText = createMockSoulText({ forbiddenWords: ['とても', 'すごく'] });
    const retaker = createRetakeAgent(deps);

    await retaker.retake('original text', 'feedback');
    const [systemPrompt] = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(systemPrompt).toContain('とても');
  });
});
