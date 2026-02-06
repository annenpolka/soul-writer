import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FullPipelineResult } from '../agents/types.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';

// =====================
// FP API
// =====================

export interface FileWriterFn {
  writeStory: (result: FullPipelineResult, theme: GeneratedTheme) => string;
}

function buildMarkdown(result: FullPipelineResult, theme: GeneratedTheme): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`title: "${result.plot.title}"`);
  lines.push(`task_id: "${result.taskId}"`);
  lines.push(`emotion: "${theme.emotion}"`);
  lines.push(`timeline: "${theme.timeline}"`);
  if (theme.tone) {
    lines.push(`tone: "${theme.tone}"`);
  }
  if (theme.narrative_type) {
    lines.push(`narrative_type: "${theme.narrative_type}"`);
  }
  lines.push(`compliance_score: ${result.avgComplianceScore.toFixed(3)}`);
  lines.push(`reader_score: ${result.avgReaderScore.toFixed(3)}`);
  lines.push('---');
  lines.push('');

  lines.push(`# ${result.plot.title}`);
  lines.push('');

  for (const chapter of result.chapters) {
    const plotChapter = result.plot.chapters[chapter.chapterIndex - 1];
    lines.push(`## ${plotChapter.title}`);
    lines.push('');
    lines.push(chapter.text);
    lines.push('');
  }

  return lines.join('\n');
}

export function createFileWriter(outputDir: string): FileWriterFn {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return {
    writeStory: (result, theme) => {
      const filename = `${result.taskId}.md`;
      const filepath = path.join(outputDir, filename);
      const content = buildMarkdown(result, theme);
      fs.writeFileSync(filepath, content, 'utf-8');
      return filepath;
    },
  };
}

