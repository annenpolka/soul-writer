import { z } from 'zod';

// --- OAuth constants (matching OpenAI Codex CLI) ---

export const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const CODEX_AUTH_ENDPOINT = 'https://auth.openai.com/oauth/authorize';
export const CODEX_TOKEN_ENDPOINT = 'https://auth.openai.com/oauth/token';
export const CODEX_REDIRECT_URI = 'http://localhost:1455/auth/callback';
export const CODEX_SCOPES = 'openid profile email offline_access';
export const CODEX_BASE_URL = 'https://chatgpt.com/backend-api';

// --- Token storage schema ---

export const CodexTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  chatgpt_account_id: z.string(),
});
export type CodexToken = z.infer<typeof CodexTokenSchema>;

// --- DI interfaces ---

export interface TokenStore {
  load(): Promise<CodexToken | null>;
  save(token: CodexToken): Promise<void>;
  clear(): Promise<void>;
}

export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface CodexConfig {
  model: string;
  instructions?: string;
  reasoningEffort?: CodexReasoningEffort;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  tokenStore?: TokenStore;
  fetchFn?: typeof fetch;
}
