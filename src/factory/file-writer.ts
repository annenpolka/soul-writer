import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FullPipelineResult } from '../agents/types.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';

/**
 * Writes generated stories to markdown files
 */
export class FileWriter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Write a generated story to a markdown file
   * @param result The full pipeline result
   * @param theme The theme used for generation
   * @returns The path to the written file
   */
  writeStory(result: FullPipelineResult, theme: GeneratedTheme): string {
    const filename = `${result.taskId}.md`;
    const filepath = path.join(this.outputDir, filename);

    const content = this.buildMarkdown(result, theme);
    fs.writeFileSync(filepath, content, 'utf-8');

    return filepath;
  }

  private buildMarkdown(result: FullPipelineResult, theme: GeneratedTheme): string {
    const lines: string[] = [];

    // Frontmatter (YAML)
    lines.push('---');
    lines.push(`title: "${result.plot.title}"`);
    lines.push(`task_id: "${result.taskId}"`);
    lines.push(`emotion: "${theme.emotion}"`);
    lines.push(`timeline: "${theme.timeline}"`);
    lines.push(`compliance_score: ${result.avgComplianceScore.toFixed(3)}`);
    lines.push(`reader_score: ${result.avgReaderScore.toFixed(3)}`);
    lines.push('---');
    lines.push('');

    // Title
    lines.push(`# ${result.plot.title}`);
    lines.push('');

    // Chapters
    for (const chapter of result.chapters) {
      const plotChapter = result.plot.chapters[chapter.chapterIndex - 1];
      lines.push(`## ${plotChapter.title}`);
      lines.push('');
      lines.push(chapter.text);
      lines.push('');
    }

    return lines.join('\n');
  }
}
