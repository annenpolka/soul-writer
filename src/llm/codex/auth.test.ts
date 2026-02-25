import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePKCE,
  createState,
  buildAuthorizationUrl,
  buildTokenExchangeBody,
  buildRefreshTokenBody,
  exchangeCodeForToken,
  refreshAccessToken,
} from './auth.js';
import {
  CODEX_CLIENT_ID,
  CODEX_AUTH_ENDPOINT,
  CODEX_TOKEN_ENDPOINT,
  CODEX_REDIRECT_URI,
  CODEX_SCOPES,
} from './types.js';

describe('generatePKCE', () => {
  it('verifierが43文字以上のbase64url文字列である', async () => {
    const { verifier } = await generatePKCE();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('challengeがbase64url文字列である', async () => {
    const { challenge } = await generatePKCE();

    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('challengeがverifierのSHA-256ハッシュである', async () => {
    const { verifier, challenge } = await generatePKCE();

    // Verify independently using crypto
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256').update(verifier).digest();
    const expectedChallenge = hash.toString('base64url');

    expect(challenge).toBe(expectedChallenge);
  });

  it('呼び出すたびに異なるverifierを生成する', async () => {
    const pkce1 = await generatePKCE();
    const pkce2 = await generatePKCE();

    expect(pkce1.verifier).not.toBe(pkce2.verifier);
  });
});

describe('createState', () => {
  it('32文字のhex文字列を返す', () => {
    const state = createState();

    expect(state).toMatch(/^[a-f0-9]{32}$/);
  });

  it('呼び出すたびに異なるstateを生成する', () => {
    expect(createState()).not.toBe(createState());
  });
});

describe('buildAuthorizationUrl', () => {
  it('全必須パラメータが含まれる', () => {
    const url = buildAuthorizationUrl('test_challenge', 'test_state');

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(CODEX_AUTH_ENDPOINT);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe(CODEX_CLIENT_ID);
    expect(parsed.searchParams.get('redirect_uri')).toBe(CODEX_REDIRECT_URI);
    expect(parsed.searchParams.get('scope')).toBe(CODEX_SCOPES);
    expect(parsed.searchParams.get('code_challenge')).toBe('test_challenge');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('state')).toBe('test_state');
    expect(parsed.searchParams.get('originator')).toBe('codex_cli_rs');
    expect(parsed.searchParams.get('codex_cli_simplified_flow')).toBe('true');
    expect(parsed.searchParams.get('id_token_add_organizations')).toBe('true');
  });
});

describe('buildTokenExchangeBody', () => {
  it('正しい形式のURLSearchParamsを返す', () => {
    const body = buildTokenExchangeBody('auth_code_123', 'verifier_456');

    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_id')).toBe(CODEX_CLIENT_ID);
    expect(body.get('code')).toBe('auth_code_123');
    expect(body.get('code_verifier')).toBe('verifier_456');
    expect(body.get('redirect_uri')).toBe(CODEX_REDIRECT_URI);
  });
});

describe('buildRefreshTokenBody', () => {
  it('正しい形式のURLSearchParamsを返す', () => {
    const body = buildRefreshTokenBody('refresh_token_789');

    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('client_id')).toBe(CODEX_CLIENT_ID);
    expect(body.get('refresh_token')).toBe('refresh_token_789');
  });
});

describe('exchangeCodeForToken', () => {
  it('トークン交換後にCodexTokenを返す', async () => {
    // JWT with chatgpt_account_id claim
    const payload = { 'https://api.openai.com/auth': { chatgpt_account_id: 'acct_test' } };
    const fakeAccessToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: fakeAccessToken,
        refresh_token: 'refresh_new',
        expires_in: 3600,
      }),
    });

    const result = await exchangeCodeForToken('auth_code', 'verifier', mockFetch);

    expect(result.access_token).toBe(fakeAccessToken);
    expect(result.refresh_token).toBe('refresh_new');
    expect(result.chatgpt_account_id).toBe('acct_test');
    expect(result.expires_at).toBeGreaterThan(Date.now());

    // Verify the fetch was called correctly
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(CODEX_TOKEN_ENDPOINT);
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('トークン交換失敗時にエラーをthrowする', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    });

    await expect(exchangeCodeForToken('bad_code', 'verifier', mockFetch))
      .rejects.toThrow();
  });
});

describe('refreshAccessToken', () => {
  it('リフレッシュ成功時に新しいトークン情報を返す', async () => {
    const payload = { 'https://api.openai.com/auth': { chatgpt_account_id: 'acct_test' } };
    const fakeAccessToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: fakeAccessToken,
        refresh_token: 'refresh_new2',
        expires_in: 7200,
      }),
    });

    const result = await refreshAccessToken('old_refresh', mockFetch);

    expect(result.access_token).toBe(fakeAccessToken);
    expect(result.refresh_token).toBe('refresh_new2');
    expect(result.expires_at).toBeGreaterThan(Date.now());
  });

  it('リフレッシュ失敗時にエラーをthrowする', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(refreshAccessToken('expired_refresh', mockFetch))
      .rejects.toThrow();
  });
});
