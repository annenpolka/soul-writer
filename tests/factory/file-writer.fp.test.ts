/**
 * FP FileWriter Tests
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createFileWriter, type FileWriterFn } from '../../src/factory/file-writer.js';
import type { FullPipelineResult } from '../../src/agents/types.js';
import type { GeneratedTheme } from '../../src/schemas/generated-theme.js';

const tempDir = path.join(process.cwd(), 'tmp-file-writer-fp-test');

const createMockResult = (): FullPipelineResult => ({
  taskId: 'test-task-123',
  plot: {
    title: 'テスト小説',
    theme: 'テーマ',
    chapters: [
      { index: 1, title: '第一章', summary: '始まりの章', key_events: ['出会い'], target_length: 4000 },
    ],
  },
  chapters: [
    {
      chapterIndex: 1,
      text: 'テスト本文です。',
      champion: 'writer_1',
      complianceResult: { isCompliant: true, score: 1, violations: [] },
      correctionAttempts: 0,
      readerJuryResult: { evaluations: [], aggregatedScore: 0.85, passed: true, summary: '' },
      tokensUsed: 100,
    },
  ],
  totalTokensUsed: 100,
  avgComplianceScore: 1.0,
  avgReaderScore: 0.85,
  learningCandidates: 0,
  antiPatternsCollected: 0,
});

const createMockTheme = (): GeneratedTheme => ({
  emotion: 'sadness',
  timeline: 'past',
  characters: [{ name: '透心', isNew: false }],
  premise: 'テスト前提',
  scene_types: ['introspection'],
});

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
});

describe('createFileWriter (FP)', () => {
  it('should create a FileWriterFn', () => {
    const writer: FileWriterFn = createFileWriter(tempDir);
    expect(writer.writeStory).toBeInstanceOf(Function);
  });

  it('should write a story file', () => {
    const writer = createFileWriter(tempDir);
    const result = createMockResult();
    const theme = createMockTheme();
    const filepath = writer.writeStory(result, theme);

    expect(fs.existsSync(filepath)).toBe(true);
    const content = fs.readFileSync(filepath, 'utf-8');
    expect(content).toContain('テスト小説');
    expect(content).toContain('テスト本文です。');
  });

  it('should create output directory if it does not exist', () => {
    const nestedDir = path.join(tempDir, 'nested', 'deep');
    const writer = createFileWriter(nestedDir);
    const result = createMockResult();
    const theme = createMockTheme();
    writer.writeStory(result, theme);
    expect(fs.existsSync(nestedDir)).toBe(true);
  });
});
