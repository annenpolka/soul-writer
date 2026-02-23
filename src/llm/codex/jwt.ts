/**
 * JWT payload decoder for extracting chatgpt_account_id from OpenAI OAuth tokens.
 * No external dependencies — uses manual base64url parsing.
 */

export function decodeJwt(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

export function extractAccountId(token: string): string | null {
  const payload = decodeJwt(token);
  if (!payload) return null;

  const authClaim = payload['https://api.openai.com/auth'];
  if (authClaim && typeof authClaim === 'object' && 'chatgpt_account_id' in authClaim) {
    return (authClaim as { chatgpt_account_id: string }).chatgpt_account_id;
  }

  return null;
}
