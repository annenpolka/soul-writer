import fs from 'fs';
import path from 'path';

export interface LoggerOptions {
  verbose: boolean;
  logFile?: string;
}

// =====================
// FP API
// =====================

export interface LoggerFn {
  info: (message: string) => void;
  warn: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
  section: (title: string) => void;
  close: () => void;
}

export function createLogger(options: LoggerOptions): LoggerFn {
  const verbose = options.verbose;
  let logStream: fs.WriteStream | null = null;

  if (options.logFile) {
    const dir = path.dirname(options.logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logStream = fs.createWriteStream(options.logFile, { flags: 'a' });
  }

  const writeToFile = (line: string): void => {
    logStream?.write(line + '\n');
  };

  return {
    info: (message) => {
      console.log(message);
      writeToFile(message);
    },

    warn: (message, data?) => {
      const line = data !== undefined
        ? `${message}\n${data instanceof Error ? data.message : typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
        : message;
      console.warn(`[WARN] ${line}`);
      writeToFile(`[WARN] ${line}`);
    },

    debug: (message, data?) => {
      if (!verbose) return;
      const line = data !== undefined
        ? `${message}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
        : message;
      console.log(`[VERBOSE] ${line}`);
      writeToFile(`[VERBOSE] ${line}`);
    },

    section: (title) => {
      if (!verbose) return;
      const line = `\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`;
      console.log(line);
      writeToFile(line);
    },

    close: () => {
      logStream?.end();
    },
  };
}
