import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileWriter } from './file-writer.js';
import type { FullPipelineResult, ChapterPipelineResult } from '../agents/types.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';
import type { Plot } from '../schemas/plot.js';

// Helper to create mock data
const createMockPlot = (): Plot => ({
  title: 'テスト物語',
  theme: 'テストテーマ',
  chapters: [
    { index: 1, title: '第一章', summary: '要約1', key_events: ['イベント1'], target_length: 4000 },
    { index: 2, title: '第二章', summary: '要約2', key_events: ['イベント2'], target_length: 4000 },
  ],
});

const createMockChapter = (index: number): ChapterPipelineResult => ({
  chapterIndex: index,
  text: `これは第${index}章の本文です。`,
  champion: 'writer_1',
  complianceResult: { isCompliant: true, score: 0.95, violations: [] },
  correctionAttempts: 0,
  readerJuryResult: { evaluations: [], aggregatedScore: 0.85, passed: true, summary: '' },
  tokensUsed: 1000,
});

const createMockResult = (): FullPipelineResult => ({
  taskId: 'test-task-123',
  plot: createMockPlot(),
  chapters: [createMockChapter(1), createMockChapter(2)],
  totalTokensUsed: 2000,
  avgComplianceScore: 0.95,
  avgReaderScore: 0.85,
  learningCandidates: 1,
  antiPatternsCollected: 0,
});

const createMockTheme = (): GeneratedTheme => ({
  emotion: '孤独',
  timeline: '出会い前',
  characters: [
    { name: '御鐘透心', isNew: false },
    { name: '新キャラ', isNew: true, description: 'テスト説明' },
  ],
  premise: 'テスト前提',
});

describe('FileWriter', () => {
  let tempDir: string;
  let writer: FileWriter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filewriter-test-'));
    writer = new FileWriter(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use existing directory', () => {
      expect(fs.existsSync(tempDir)).toBe(true);
      const w = new FileWriter(tempDir);
      expect(w).toBeInstanceOf(FileWriter);
    });

    it('should create output directory if not exists', () => {
      const newDir = path.join(tempDir, 'nested', 'dir');
      expect(fs.existsSync(newDir)).toBe(false);

      new FileWriter(newDir);

      expect(fs.existsSync(newDir)).toBe(true);
    });
  });

  describe('writeStory', () => {
    it('should write story to markdown file', () => {
      const result = createMockResult();
      const theme = createMockTheme();

      const filepath = writer.writeStory(result, theme);

      expect(fs.existsSync(filepath)).toBe(true);
      expect(filepath).toContain('test-task-123.md');
    });

    it('should include frontmatter with metadata', () => {
      const result = createMockResult();
      const theme = createMockTheme();

      const filepath = writer.writeStory(result, theme);
      const content = fs.readFileSync(filepath, 'utf-8');

      expect(content).toMatch(/^---\n/);
      expect(content).toContain('title: "テスト物語"');
      expect(content).toContain('task_id: "test-task-123"');
      expect(content).toContain('emotion: "孤独"');
      expect(content).toContain('timeline: "出会い前"');
      expect(content).toContain('compliance_score: 0.950');
      expect(content).toContain('reader_score: 0.850');
    });

    it('should include story title as heading', () => {
      const result = createMockResult();
      const theme = createMockTheme();

      const filepath = writer.writeStory(result, theme);
      const content = fs.readFileSync(filepath, 'utf-8');

      expect(content).toContain('# テスト物語');
    });

    it('should include chapter headings and content', () => {
      const result = createMockResult();
      const theme = createMockTheme();

      const filepath = writer.writeStory(result, theme);
      const content = fs.readFileSync(filepath, 'utf-8');

      expect(content).toContain('## 第一章');
      expect(content).toContain('## 第二章');
      expect(content).toContain('これは第1章の本文です。');
      expect(content).toContain('これは第2章の本文です。');
    });
  });
});
