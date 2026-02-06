/**
 * FP Logger Tests
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger, type LoggerFn } from '../src/logger.js';

const tempDir = path.join(process.cwd(), 'tmp-logger-fp-test');

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
});

describe('createLogger (FP)', () => {
  it('should create a LoggerFn', () => {
    const logger: LoggerFn = createLogger({ verbose: false });
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.debug).toBeInstanceOf(Function);
    expect(logger.section).toBeInstanceOf(Function);
    expect(logger.close).toBeInstanceOf(Function);
  });

  it('should log info to console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ verbose: false });
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith('test message');
    spy.mockRestore();
  });

  it('should not log debug when not verbose', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ verbose: false });
    logger.debug('debug message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log debug when verbose', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ verbose: true });
    logger.debug('debug message');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('debug message'));
    spy.mockRestore();
  });

  it('should write to log file when specified', async () => {
    const logFile = path.join(tempDir, 'test.log');
    const logger = createLogger({ verbose: true, logFile });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('file log test');
    // Wait for stream to flush
    await new Promise<void>((resolve) => {
      logger.close();
      setTimeout(resolve, 50);
    });
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('file log test');
    vi.restoreAllMocks();
  });

  it('should create noop logger', () => {
    const logger = createLogger({ verbose: false });
    expect(logger).toBeDefined();
    // noop should not throw
    logger.info('noop');
    logger.debug('noop');
    logger.section('noop');
    logger.close();
  });
});
