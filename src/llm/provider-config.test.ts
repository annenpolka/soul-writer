import { describe, expect, it } from 'vitest';
import { resolveLLMConfig } from './config.js';

describe('resolveLLMConfig', () => {
  it('環境変数だけでCerebras設定を解決する', () => {
    const config = resolveLLMConfig({
      LLM_PROVIDER: 'cerebras',
      CEREBRAS_API_KEY: 'test-key',
      CEREBRAS_MODEL: 'test-model',
    });

    expect(config).toMatchObject({
      provider: 'cerebras',
      apiKey: 'test-key',
      model: 'test-model',
    });
  });

  it('CLIオーバーライドが環境変数より優先される', () => {
    const config = resolveLLMConfig(
      {
        LLM_PROVIDER: 'cerebras',
        CEREBRAS_API_KEY: 'test-key',
        CEREBRAS_MODEL: 'env-model',
      },
      {
        provider: 'cerebras',
        model: 'cli-model',
      },
    );

    expect(config.model).toBe('cli-model');
  });

  it('Codexのreasoning effortを正規化する', () => {
    const config = resolveLLMConfig(
      {
        LLM_PROVIDER: 'codex',
        CODEX_MODEL: 'gpt-test',
        CODEX_REASONING_EFFORT: 'invalid',
      },
    );

    expect(config).toMatchObject({
      provider: 'codex',
      model: 'gpt-test',
      reasoningEffort: 'medium',
    });
  });

  it('未知のproviderでは利用可能provider一覧を含むエラーを返す', () => {
    expect(() => resolveLLMConfig({ LLM_PROVIDER: 'missing-provider' }))
      .toThrow(/Available providers: cerebras, codex, openai-compatible/);
  });
});
