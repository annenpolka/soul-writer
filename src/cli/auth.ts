/**
 * CLI auth command — login/logout/status for Codex OAuth.
 */

import { exec } from 'node:child_process';
import {
  generatePKCE,
  createState,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  createFileTokenStore,
} from '../llm/codex/index.js';

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  exec(`${cmd} "${url}"`, (err) => {
    if (err) {
      console.log(`\nCould not open browser automatically. Please open this URL manually:\n${url}\n`);
    }
  });
}

export interface AuthOptions {
  action: 'login' | 'logout' | 'status';
}

export async function auth(options: AuthOptions): Promise<void> {
  const tokenStore = createFileTokenStore();

  switch (options.action) {
    case 'login': {
      console.log('Starting Codex OAuth login...\n');

      const { verifier, challenge } = await generatePKCE();
      const state = createState();
      const authUrl = buildAuthorizationUrl(challenge, state);

      console.log('Opening browser for authentication...');
      openBrowser(authUrl);

      console.log('Waiting for OAuth callback on localhost:1455...');
      const { waitForCallback } = await import('../llm/codex/auth-server.js');
      const code = await waitForCallback(state);

      console.log('Exchanging authorization code for tokens...');
      const token = await exchangeCodeForToken(code, verifier);
      await tokenStore.save(token);

      console.log(`\n✓ Authentication successful!`);
      console.log(`  Account ID: ${token.chatgpt_account_id}`);
      console.log(`  Token expires: ${new Date(token.expires_at).toLocaleString()}`);
      break;
    }

    case 'logout': {
      await tokenStore.clear();
      console.log('✓ Logged out. Stored tokens cleared.');
      break;
    }

    case 'status': {
      const token = await tokenStore.load();
      if (!token) {
        console.log('Not authenticated. Run: npx tsx src/main.ts auth login');
        return;
      }

      const isExpired = token.expires_at < Date.now();
      console.log('Codex OAuth Status:');
      console.log(`  Account ID: ${token.chatgpt_account_id}`);
      console.log(`  Token expires: ${new Date(token.expires_at).toLocaleString()}`);
      console.log(`  Status: ${isExpired ? '✗ Expired (will auto-refresh on next request)' : '✓ Valid'}`);
      break;
    }
  }
}
