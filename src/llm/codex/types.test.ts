import { describe, it, expect } from 'vitest';
import { CodexTokenSchema } from './types.js';

describe('CodexTokenSchema', () => {
  it('正常なトークンをバリデーションできる', () => {
    const token = {
      access_token: 'eyJhbGciOiJSUzI1NiJ9.test.sig',
      refresh_token: 'refresh_abc123',
      expires_at: Date.now() + 3600_000,
      chatgpt_account_id: 'acct_abc123',
    };

    const result = CodexTokenSchema.safeParse(token);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(token);
    }
  });

  it('不正なトークンを拒否する（フィールド欠落）', () => {
    const incomplete = {
      access_token: 'token',
      // refresh_token missing
      expires_at: 12345,
      chatgpt_account_id: 'acct',
    };

    const result = CodexTokenSchema.safeParse(incomplete);

    expect(result.success).toBe(false);
  });

  it('不正な型を拒否する', () => {
    const wrongTypes = {
      access_token: 123, // should be string
      refresh_token: 'refresh',
      expires_at: 'not-a-number', // should be number
      chatgpt_account_id: 'acct',
    };

    const result = CodexTokenSchema.safeParse(wrongTypes);

    expect(result.success).toBe(false);
  });
});
