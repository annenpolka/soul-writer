/**
 * OAuth 2.0 PKCE authentication flow for OpenAI Codex.
 * Implements the same flow as the official Codex CLI.
 */

import * as crypto from 'node:crypto';
import { extractAccountId } from './jwt.js';
import {
  CODEX_CLIENT_ID,
  CODEX_AUTH_ENDPOINT,
  CODEX_TOKEN_ENDPOINT,
  CODEX_REDIRECT_URI,
  CODEX_SCOPES,
  type CodexToken,
} from './types.js';

export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const buffer = crypto.randomBytes(64);
  const verifier = buffer.toString('base64url');
  const hash = crypto.createHash('sha256').update(verifier).digest();
  const challenge = hash.toString('base64url');
  return { verifier, challenge };
}

export function createState(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function buildAuthorizationUrl(challenge: string, state: string): string {
  const url = new URL(CODEX_AUTH_ENDPOINT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CODEX_CLIENT_ID);
  url.searchParams.set('redirect_uri', CODEX_REDIRECT_URI);
  url.searchParams.set('scope', CODEX_SCOPES);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  url.searchParams.set('id_token_add_organizations', 'true');
  url.searchParams.set('codex_cli_simplified_flow', 'true');
  url.searchParams.set('originator', 'codex_cli_rs');
  return url.toString();
}

export function buildTokenExchangeBody(code: string, verifier: string): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CODEX_CLIENT_ID,
    code,
    code_verifier: verifier,
    redirect_uri: CODEX_REDIRECT_URI,
  });
}

export function buildRefreshTokenBody(refreshToken: string): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CODEX_CLIENT_ID,
    refresh_token: refreshToken,
  });
}

export async function exchangeCodeForToken(
  code: string,
  verifier: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<CodexToken> {
  const body = buildTokenExchangeBody(code, verifier);

  const response = await fetchFn(CODEX_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const json = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const accountId = extractAccountId(json.access_token);
  if (!accountId) {
    throw new Error('Failed to extract chatgpt_account_id from access token JWT');
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
    chatgpt_account_id: accountId,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<CodexToken> {
  const body = buildRefreshTokenBody(refreshToken);

  const response = await fetchFn(CODEX_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const json = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const accountId = extractAccountId(json.access_token);
  if (!accountId) {
    throw new Error('Failed to extract chatgpt_account_id from refreshed access token JWT');
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
    chatgpt_account_id: accountId,
  };
}
