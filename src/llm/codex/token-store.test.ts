import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createFileTokenStore } from './token-store.js';
import type { CodexToken } from './types.js';

const validToken: CodexToken = {
  access_token: 'eyJhbGciOiJSUzI1NiJ9.test.sig',
  refresh_token: 'refresh_abc123',
  expires_at: Date.now() + 3600_000,
  chatgpt_account_id: 'acct_abc123',
};

describe('FileTokenStore', () => {
  let tmpDir: string;
  let tokenPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-test-'));
    tokenPath = path.join(tmpDir, 'auth.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ファイルが存在しない時にnullを返す', async () => {
    const store = createFileTokenStore(tokenPath);

    const result = await store.load();

    expect(result).toBeNull();
  });

  it('save()でファイルを作成できる', async () => {
    const store = createFileTokenStore(tokenPath);

    await store.save(validToken);

    expect(fs.existsSync(tokenPath)).toBe(true);
  });

  it('save()でファイル権限が0o600になる', async () => {
    const store = createFileTokenStore(tokenPath);

    await store.save(validToken);

    const stats = fs.statSync(tokenPath);
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it('save()でディレクトリを自動作成する', async () => {
    const nestedPath = path.join(tmpDir, 'nested', 'dir', 'auth.json');
    const store = createFileTokenStore(nestedPath);

    await store.save(validToken);

    expect(fs.existsSync(nestedPath)).toBe(true);
  });

  it('save()→load()のラウンドトリップ', async () => {
    const store = createFileTokenStore(tokenPath);

    await store.save(validToken);
    const result = await store.load();

    expect(result).toEqual(validToken);
  });

  it('不正なJSONでnullを返す', async () => {
    fs.writeFileSync(tokenPath, 'not-json', { mode: 0o600 });
    const store = createFileTokenStore(tokenPath);

    const result = await store.load();

    expect(result).toBeNull();
  });

  it('Zodバリデーション失敗でnullを返す', async () => {
    const invalid = { access_token: 'tok', refresh_token: 'ref' }; // missing fields
    fs.writeFileSync(tokenPath, JSON.stringify(invalid), { mode: 0o600 });
    const store = createFileTokenStore(tokenPath);

    const result = await store.load();

    expect(result).toBeNull();
  });

  it('clear()でファイルを削除できる', async () => {
    const store = createFileTokenStore(tokenPath);
    await store.save(validToken);
    expect(fs.existsSync(tokenPath)).toBe(true);

    await store.clear();

    expect(fs.existsSync(tokenPath)).toBe(false);
  });

  it('clear()でファイルが存在しない時にエラーにならない', async () => {
    const store = createFileTokenStore(tokenPath);

    await expect(store.clear()).resolves.toBeUndefined();
  });
});
