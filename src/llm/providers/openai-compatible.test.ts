import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenAICompatibleClient, openAICompatibleProvider } from './openai-compatible.js';

function createJsonFetch(body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as unknown as typeof fetch;
}

describe('OpenAICompatibleClient', () => {
  it('chat/completionsへテキスト生成リクエストを送る', async () => {
    const fetchFn = createJsonFetch({
      choices: [{ message: { content: 'hello' } }],
      usage: { total_tokens: 12 },
    });
    const client = new OpenAICompatibleClient({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1/',
      model: 'test-model',
      fetchFn,
    });

    const result = await client.complete('system', 'user');

    expect(result).toBe('hello');
    expect(client.getTotalTokens()).toBe(12);
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'test-model',
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'user' },
      ],
    });
  });

  it('構造化出力をjson_schemaで要求しZodで検証する', async () => {
    const fetchFn = createJsonFetch({
      choices: [{ message: { content: JSON.stringify({ name: '透心', score: 9 }) } }],
      usage: { total_tokens: 20 },
    });
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.test/v1',
      model: 'test-model',
      fetchFn,
    });
    const schema = z.object({ name: z.string(), score: z.number() });

    const result = await client.completeStructured(
      [{ role: 'user', content: '評価して' }],
      schema,
    );

    expect(result.data).toEqual({ name: '透心', score: 9 });
    expect(result.tokensUsed).toBe(20);
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    const requestBody = JSON.parse(init.body);
    expect(requestBody.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'response',
        strict: true,
      },
    });
  });
});

describe('openAICompatibleProvider', () => {
  it('環境変数から設定を解決する', () => {
    const config = openAICompatibleProvider.resolveConfig({
      env: {
        OPENAI_COMPAT_BASE_URL: 'https://example.test/v1',
        OPENAI_COMPAT_API_KEY: 'test-key',
        OPENAI_COMPAT_MODEL: 'test-model',
      },
      overrides: {},
    });

    expect(config).toMatchObject({
      provider: 'openai-compatible',
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    });
  });

  it('baseUrl未設定時に分かりやすいエラーを返す', () => {
    expect(() => openAICompatibleProvider.resolveConfig({ env: {}, overrides: {} }))
      .toThrow('OPENAI_COMPAT_BASE_URL is required for openai-compatible provider');
  });
});
