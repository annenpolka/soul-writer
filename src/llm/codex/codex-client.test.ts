import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { CodexClient } from './codex-client.js';
import type { CodexToken, TokenStore, CodexConfig } from './types.js';
import { CODEX_BASE_URL } from './types.js';

// --- Test helpers ---

function createMockToken(overrides?: Partial<CodexToken>): CodexToken {
  return {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expires_at: Date.now() + 3600_000, // 1 hour from now
    chatgpt_account_id: 'acct_test123',
    ...overrides,
  };
}

function createMockTokenStore(token: CodexToken | null = null): TokenStore {
  let stored = token;
  return {
    load: vi.fn(async () => stored),
    save: vi.fn(async (t: CodexToken) => { stored = t; }),
    clear: vi.fn(async () => { stored = null; }),
  };
}

function makeCompletedSSE(text: string, opts?: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoning?: string;
}): string {
  const output: unknown[] = [];

  if (opts?.reasoning) {
    output.push({
      id: 'reasoning_1',
      type: 'reasoning',
      summary: [{ type: 'summary_text', text: opts.reasoning }],
    });
  }

  output.push({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_text', text }],
  });

  const response = {
    id: 'resp_1',
    status: 'completed',
    output,
    output_text: text,
    usage: {
      input_tokens: opts?.inputTokens ?? 10,
      output_tokens: opts?.outputTokens ?? 5,
      total_tokens: opts?.totalTokens ?? 15,
    },
  };

  return `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response })}\n\n`;
}

function createMockFetch(sseBody: string, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseBody));
        controller.close();
      },
    }),
    text: () => Promise.resolve(sseBody),
  })) as unknown as typeof fetch;
}

function createFailedSSE(message: string): string {
  const response = {
    id: 'resp_fail',
    status: 'failed',
    error: { code: 'server_error', message },
  };
  return `event: response.failed\ndata: ${JSON.stringify({ type: 'response.failed', response })}\n\n`;
}

function createClient(opts?: {
  token?: CodexToken | null;
  fetchFn?: typeof fetch;
  model?: string;
  maxRetries?: number;
}): CodexClient {
  const config: CodexConfig = {
    model: opts?.model ?? 'gpt-5.2',
    maxRetries: opts?.maxRetries ?? 1,
    initialRetryDelayMs: 1, // fast retries for tests
    maxRetryDelayMs: 1,
    tokenStore: createMockTokenStore(opts && 'token' in opts ? opts.token : createMockToken()),
    fetchFn: opts?.fetchFn ?? createMockFetch(makeCompletedSSE('default response')),
  };
  return new CodexClient(config);
}

// --- Tests ---

describe('CodexClient', () => {
  describe('complete() — string overload', () => {
    it('systemPromptとuserPromptからレスポンステキストを返す', async () => {
      const mockFetch = createMockFetch(makeCompletedSSE('Hello from Codex'));
      const client = createClient({ fetchFn: mockFetch });

      const result = await client.complete('You are helpful', 'Say hello');

      expect(result).toBe('Hello from Codex');
    });

    it('systemメッセージをinstructionsフィールドに設定する', async () => {
      const mockFetch = createMockFetch(makeCompletedSSE('ok'));
      const client = createClient({ fetchFn: mockFetch });

      await client.complete('System prompt here', 'User message');

      const [, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.instructions).toBe('System prompt here');
      expect(body.input).toEqual([
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'User message' }] },
      ]);
    });
  });

  describe('complete() — messages overload', () => {
    it('LLMMessage配列からレスポンスを返す', async () => {
      const mockFetch = createMockFetch(makeCompletedSSE('Messages response'));
      const client = createClient({ fetchFn: mockFetch });

      const result = await client.complete([
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toBe('Messages response');
    });

    it('system以外のメッセージをinput配列に変換する', async () => {
      const mockFetch = createMockFetch(makeCompletedSSE('ok'));
      const client = createClient({ fetchFn: mockFetch });

      await client.complete([
        { role: 'system', content: 'System' },
        { role: 'user', content: 'User msg' },
        { role: 'assistant', content: 'Assistant msg' },
        { role: 'user', content: 'Follow up' },
      ]);

      const [, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.instructions).toBe('System');
      expect(body.input).toEqual([
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'User msg' }] },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Assistant msg' }] },
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Follow up' }] },
      ]);
    });
  });

  describe('リクエストフォーマット', () => {
    it('正しいヘッダでリクエストを送信する', async () => {
      const token = createMockToken({ chatgpt_account_id: 'acct_header_test' });
      const mockFetch = createMockFetch(makeCompletedSSE('ok'));
      const client = createClient({ token, fetchFn: mockFetch });

      await client.complete('sys', 'user');

      const [url, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${CODEX_BASE_URL}/codex/responses`);
      const headers = opts.headers;
      expect(headers['Authorization']).toBe('Bearer test_access_token');
      expect(headers['chatgpt-account-id']).toBe('acct_header_test');
      expect(headers['originator']).toBe('codex_cli_rs');
      expect(headers['OpenAI-Beta']).toBe('responses=experimental');
    });

    it('store: falseとstream: trueがリクエストボディに含まれる', async () => {
      const mockFetch = createMockFetch(makeCompletedSSE('ok'));
      const client = createClient({ fetchFn: mockFetch });

      await client.complete('sys', 'user');

      const [, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.store).toBe(false);
      expect(body.stream).toBe(true);
      expect(body.model).toBe('gpt-5.2');
    });

    it('temperature/max_output_tokens/top_pをリクエストボディに含めない', async () => {
      const mockFetch = createMockFetch(makeCompletedSSE('ok'));
      const client = createClient({ fetchFn: mockFetch });

      await client.complete('sys', 'user', {
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
      });

      const [, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.temperature).toBeUndefined();
      expect(body.max_output_tokens).toBeUndefined();
      expect(body.top_p).toBeUndefined();
    });
  });

  describe('getTotalTokens', () => {
    it('トークン使用量を蓄積する', async () => {
      const mockFetch = createMockFetch(makeCompletedSSE('first', { totalTokens: 100 }));
      const client = createClient({ fetchFn: mockFetch });

      expect(client.getTotalTokens()).toBe(0);

      await client.complete('sys', 'user');
      expect(client.getTotalTokens()).toBe(100);
    });
  });

  describe('completeStructured', () => {
    const TestSchema = z.object({
      name: z.string(),
      score: z.number(),
    });

    it('text.formatにjson_schemaを設定してリクエストする', async () => {
      const responseJson = JSON.stringify({ name: 'Test', score: 42 });
      const mockFetch = createMockFetch(makeCompletedSSE(responseJson));
      const client = createClient({ fetchFn: mockFetch });

      const result = await client.completeStructured(
        [{ role: 'system', content: 'sys' }, { role: 'user', content: 'user' }],
        TestSchema,
      );

      expect(result.data).toEqual({ name: 'Test', score: 42 });

      const [, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.text?.format?.type).toBe('json_schema');
      expect(body.text?.format?.strict).toBe(true);
    });

    it('optionalフィールドをnullableにしてrequiredに含める', async () => {
      const SchemaWithOptional = z.object({
        style: z.number(),
        compliance: z.number(),
        voice_accuracy: z.number().optional(),
        originality: z.number().optional(),
      });

      // Response with valid values (Zod parse needs valid data)
      const responseJson = JSON.stringify({ style: 8, compliance: 9, voice_accuracy: 7, originality: 6 });
      const mockFetch = createMockFetch(makeCompletedSSE(responseJson));
      const client = createClient({ fetchFn: mockFetch });

      await client.completeStructured(
        [{ role: 'user', content: 'test' }],
        SchemaWithOptional,
      );

      const [, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(opts.body);
      const schema = body.text?.format?.schema;

      // All properties must be in required
      expect(schema.required).toContain('style');
      expect(schema.required).toContain('compliance');
      expect(schema.required).toContain('voice_accuracy');
      expect(schema.required).toContain('originality');
      expect(schema.required.length).toBe(4);

      // Optional fields should be nullable
      expect(schema.properties.voice_accuracy).toEqual({ type: ['number', 'null'] });
      expect(schema.properties.originality).toEqual({ type: ['number', 'null'] });

      // Required fields should stay as-is
      expect(schema.properties.style).toEqual({ type: 'number' });
    });

    it('ネストされたoptionalフィールドもnullableにする', async () => {
      const NestedSchema = z.object({
        scores: z.object({
          A: z.object({
            style: z.number(),
            voice_accuracy: z.number().optional(),
          }),
        }),
      });

      const responseJson = JSON.stringify({ scores: { A: { style: 8, voice_accuracy: 7 } } });
      const mockFetch = createMockFetch(makeCompletedSSE(responseJson));
      const client = createClient({ fetchFn: mockFetch });

      await client.completeStructured(
        [{ role: 'user', content: 'test' }],
        NestedSchema,
      );

      const [, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(opts.body);
      const innerSchema = body.text?.format?.schema?.properties?.scores?.properties?.A;

      expect(innerSchema.required).toContain('style');
      expect(innerSchema.required).toContain('voice_accuracy');
      expect(innerSchema.properties.voice_accuracy).toEqual({ type: ['number', 'null'] });
    });

    it('optionalなオブジェクト全体もnullableにする', async () => {
      const SchemaWithOptionalObj = z.object({
        name: z.string(),
        metadata: z.object({
          tag: z.string(),
        }).optional(),
      });

      const responseJson = JSON.stringify({ name: 'Test', metadata: { tag: 'ok' } });
      const mockFetch = createMockFetch(makeCompletedSSE(responseJson));
      const client = createClient({ fetchFn: mockFetch });

      await client.completeStructured(
        [{ role: 'user', content: 'test' }],
        SchemaWithOptionalObj,
      );

      const [, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(opts.body);
      const schema = body.text?.format?.schema;

      expect(schema.required).toContain('name');
      expect(schema.required).toContain('metadata');
      // Optional object should be wrapped in anyOf with null
      const metaProp = schema.properties.metadata;
      expect(metaProp.anyOf).toBeDefined();
      expect(metaProp.anyOf).toContainEqual({ type: 'null' });
    });

    it('レスポンスのJSONをZodスキーマでパースする', async () => {
      const responseJson = JSON.stringify({ name: 'Valid', score: 100 });
      const mockFetch = createMockFetch(makeCompletedSSE(responseJson, { totalTokens: 50 }));
      const client = createClient({ fetchFn: mockFetch });

      const result = await client.completeStructured(
        [{ role: 'user', content: 'test' }],
        TestSchema,
      );

      expect(result.data.name).toBe('Valid');
      expect(result.data.score).toBe(100);
      expect(result.tokensUsed).toBe(50);
    });

    it('reasoningを抽出する', async () => {
      const responseJson = JSON.stringify({ name: 'Test', score: 1 });
      const mockFetch = createMockFetch(makeCompletedSSE(responseJson, { reasoning: 'Thought about it...' }));
      const client = createClient({ fetchFn: mockFetch });

      const result = await client.completeStructured(
        [{ role: 'user', content: 'test' }],
        TestSchema,
      );

      expect(result.reasoning).toBe('Thought about it...');
    });

    it('レスポンスのnull値をoptionalフィールドとして扱う', async () => {
      const SchemaWithOptional = z.object({
        style: z.number(),
        voice_accuracy: z.number().optional(),
        detail: z.string().optional(),
      });

      // API returns null for optional fields (due to strict schema requiring all fields)
      const responseJson = JSON.stringify({ style: 8, voice_accuracy: null, detail: null });
      const mockFetch = createMockFetch(makeCompletedSSE(responseJson));
      const client = createClient({ fetchFn: mockFetch });

      const result = await client.completeStructured(
        [{ role: 'user', content: 'test' }],
        SchemaWithOptional,
      );

      expect(result.data.style).toBe(8);
      expect(result.data.voice_accuracy).toBeUndefined();
      expect(result.data.detail).toBeUndefined();
    });
  });

  describe('リトライ/エラーハンドリング', () => {
    it('500エラーでリトライする', async () => {
      const calls: number[] = [];
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        calls.push(callCount);
        if (callCount === 1) {
          return {
            ok: false,
            status: 500,
            headers: new Headers(),
            text: () => Promise.resolve('Server Error'),
          };
        }
        // Second call succeeds
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(makeCompletedSSE('retry success')));
              controller.close();
            },
          }),
        };
      }) as unknown as typeof fetch;

      const client = createClient({ fetchFn: mockFetch, maxRetries: 2 });
      const result = await client.complete('sys', 'user');

      expect(result).toBe('retry success');
      expect(calls.length).toBe(2);
    });

    it('403エラーでリトライしない', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: false,
        status: 403,
        headers: new Headers(),
        text: () => Promise.resolve('Forbidden'),
      })) as unknown as typeof fetch;

      const client = createClient({ fetchFn: mockFetch, maxRetries: 3 });

      await expect(client.complete('sys', 'user')).rejects.toThrow('403');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('maxRetries超過後にエラーをthrowする', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: () => Promise.resolve('Server Error'),
      })) as unknown as typeof fetch;

      const client = createClient({ fetchFn: mockFetch, maxRetries: 2 });

      await expect(client.complete('sys', 'user')).rejects.toThrow('2 retries');
    });

    it('429エラーでRetry-Afterヘッダを尊重する', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            headers: new Headers({ 'retry-after': '1' }),
            text: () => Promise.resolve('Rate limited'),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(makeCompletedSSE('after rate limit')));
              controller.close();
            },
          }),
        };
      }) as unknown as typeof fetch;

      const client = createClient({ fetchFn: mockFetch, maxRetries: 2 });
      const result = await client.complete('sys', 'user');

      expect(result).toBe('after rate limit');
    });
  });

  describe('トークン管理', () => {
    it('未認証時に明確なエラーメッセージを出す', async () => {
      const client = createClient({ token: null });

      await expect(client.complete('sys', 'user'))
        .rejects.toThrow('Not authenticated');
    });

    it('期限切れトークンを自動リフレッシュする', async () => {
      const expiredToken = createMockToken({
        expires_at: Date.now() - 1000, // expired
      });
      const tokenStore = createMockTokenStore(expiredToken);

      // Mock fetch for both refresh and API calls
      let callCount = 0;
      const payload = { 'https://api.openai.com/auth': { chatgpt_account_id: 'acct_refreshed' } };
      const newAccessToken = `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

      const mockFetch = vi.fn(async (url: string) => {
        callCount++;
        if (typeof url === 'string' && url.includes('oauth/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({
              access_token: newAccessToken,
              refresh_token: 'new_refresh',
              expires_in: 3600,
            }),
          };
        }
        // API call
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(makeCompletedSSE('refreshed!')));
              controller.close();
            },
          }),
        };
      }) as unknown as typeof fetch;

      const config: CodexConfig = {
        model: 'gpt-5.2',
        maxRetries: 1,
        initialRetryDelayMs: 1,
        maxRetryDelayMs: 1,
        tokenStore,
        fetchFn: mockFetch,
      };
      const client = new CodexClient(config);

      const result = await client.complete('sys', 'user');

      expect(result).toBe('refreshed!');
      expect(tokenStore.save).toHaveBeenCalled();
    });
  });
});
