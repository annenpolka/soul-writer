import fs from 'fs';
import path from 'path';

export interface LoggerOptions {
  verbose: boolean;
  logFile?: string;
}

export class Logger {
  private verbose: boolean;
  private logStream: fs.WriteStream | null = null;

  constructor(options: LoggerOptions) {
    this.verbose = options.verbose;
    if (options.logFile) {
      const dir = path.dirname(options.logFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.logStream = fs.createWriteStream(options.logFile, { flags: 'a' });
    }
  }

  info(message: string): void {
    console.log(message);
    this.writeToFile(message);
  }

  debug(message: string, data?: unknown): void {
    if (!this.verbose) return;
    const line = data !== undefined
      ? `${message}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
      : message;
    console.log(`[VERBOSE] ${line}`);
    this.writeToFile(`[VERBOSE] ${line}`);
  }

  section(title: string): void {
    if (!this.verbose) return;
    const line = `\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`;
    console.log(line);
    this.writeToFile(line);
  }

  private writeToFile(line: string): void {
    this.logStream?.write(line + '\n');
  }

  close(): void {
    this.logStream?.end();
  }

  static noop(): Logger {
    return new Logger({ verbose: false });
  }
}
