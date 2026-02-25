import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CodexTokenSchema, type CodexToken, type TokenStore } from './types.js';

const DEFAULT_TOKEN_PATH = path.join(os.homedir(), '.codex', 'auth.json');

export function createFileTokenStore(filePath: string = DEFAULT_TOKEN_PATH): TokenStore {
  return {
    async load(): Promise<CodexToken | null> {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);
        const result = CodexTokenSchema.safeParse(json);
        return result.success ? result.data : null;
      } catch {
        return null;
      }
    },

    async save(token: CodexToken): Promise<void> {
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(filePath, JSON.stringify(token, null, 2), { mode: 0o600 });
    },

    async clear(): Promise<void> {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    },
  };
}
