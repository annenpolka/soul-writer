/**
 * Local HTTP server for OAuth callback on localhost:1455.
 * Listens for the authorization code redirect from OpenAI.
 */

import * as http from 'node:http';

const CALLBACK_PORT = 1455;
const CALLBACK_TIMEOUT_MS = 60_000;

const SUCCESS_HTML = `<!DOCTYPE html><html><body>
<h1>Authentication successful</h1>
<p>You can close this window and return to the terminal.</p>
</body></html>`;

const ERROR_HTML = `<!DOCTYPE html><html><body>
<h1>Authentication failed</h1>
<p>Missing or invalid authorization parameters.</p>
</body></html>`;

export interface CallbackResult {
  code: string;
  state: string;
}

export function extractCallbackParams(url: string): CallbackResult | null {
  try {
    const parsed = new URL(url, 'http://localhost');
    const code = parsed.searchParams.get('code');
    const state = parsed.searchParams.get('state');
    if (code && state) return { code, state };
    return null;
  } catch {
    return null;
  }
}

export function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth callback timed out after 60 seconds'));
    }, CALLBACK_TIMEOUT_MS);

    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith('/auth/callback')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const params = extractCallbackParams(req.url);

      if (!params) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
        clearTimeout(timeout);
        server.close();
        reject(new Error('Missing authorization code or state in callback'));
        return;
      }

      if (params.state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
        clearTimeout(timeout);
        server.close();
        reject(new Error('State mismatch — possible CSRF attack'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(SUCCESS_HTML);
      clearTimeout(timeout);
      server.close();
      resolve(params.code);
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        reject(new Error(`Port ${CALLBACK_PORT} is already in use. Close the conflicting process and try again.`));
      } else {
        reject(err);
      }
    });

    server.listen(CALLBACK_PORT, '127.0.0.1');
  });
}
