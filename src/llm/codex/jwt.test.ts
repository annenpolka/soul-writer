import { describe, it, expect } from 'vitest';
import { decodeJwt, extractAccountId } from './jwt.js';

// テスト用ヘルパー: ペイロードからJWTを生成
function createTestJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'test-signature';
  return `${header}.${body}.${signature}`;
}

describe('decodeJwt', () => {
  it('正常なJWTからペイロードをデコードできる', () => {
    const payload = { sub: 'user-123', name: 'Test User' };
    const token = createTestJwt(payload);

    const result = decodeJwt(token);

    expect(result).toEqual(payload);
  });

  it('不正な形式（パーツ不足）でnullを返す', () => {
    expect(decodeJwt('only-one-part')).toBeNull();
    expect(decodeJwt('two.parts')).toBeNull();
    expect(decodeJwt('')).toBeNull();
  });

  it('base64url文字（-, _）を正しくデコードする', () => {
    // base64url uses - and _ instead of + and /
    const payload = { data: 'value with special chars: +/=' };
    const token = createTestJwt(payload);

    const result = decodeJwt(token);

    expect(result).toEqual(payload);
  });

  it('パディングなしのbase64urlを正しくデコードする', () => {
    // base64url omits padding =
    const payload = { id: 'a' }; // short payload to test padding edge case
    const token = createTestJwt(payload);

    const result = decodeJwt(token);

    expect(result).toEqual(payload);
  });

  it('不正なJSONでnullを返す', () => {
    // Create a token with invalid JSON in the payload
    const header = Buffer.from('{"alg":"RS256"}').toString('base64url');
    const invalidBody = Buffer.from('not-json').toString('base64url');
    const token = `${header}.${invalidBody}.sig`;

    expect(decodeJwt(token)).toBeNull();
  });
});

describe('extractAccountId', () => {
  it('https://api.openai.com/authクレームからchatgpt_account_idを抽出できる', () => {
    const payload = {
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'acct_abc123',
      },
    };
    const token = createTestJwt(payload);

    expect(extractAccountId(token)).toBe('acct_abc123');
  });

  it('クレームが存在しない場合にnullを返す', () => {
    const payload = { sub: 'user-123' };
    const token = createTestJwt(payload);

    expect(extractAccountId(token)).toBeNull();
  });

  it('chatgpt_account_idが存在しない場合にnullを返す', () => {
    const payload = {
      'https://api.openai.com/auth': {
        other_field: 'value',
      },
    };
    const token = createTestJwt(payload);

    expect(extractAccountId(token)).toBeNull();
  });

  it('不正なトークンでnullを返す', () => {
    expect(extractAccountId('invalid-token')).toBeNull();
  });
});
