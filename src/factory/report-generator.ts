import type { BatchAnalytics, GroupStats } from './analytics.js';
import type { BatchResult } from './batch-runner.js';

export interface JsonReport {
  timestamp: string;
  summary: {
    totalTasks: number;
    completed: number;
    failed: number;
    skipped: number;
    totalTokensUsed: number;
  };
  analytics: {
    successRate: number;
    avgComplianceScore: number;
    avgReaderScore: number;
    complianceDistribution: { min: number; max: number; median: number };
    readerDistribution: { min: number; max: number; median: number };
    byEmotion: Array<{ emotion: string } & GroupStats>;
    byTimeline: Array<{ timeline: string } & GroupStats>;
  };
}

export class ReportGenerator {
  generateCliReport(analytics: BatchAnalytics): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('📊 Detailed Report');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    // Overview
    lines.push('Overview:');
    lines.push(`  Success Rate: ${(analytics.successRate * 100).toFixed(1)}%`);
    lines.push(`  Total Tokens: ${analytics.totalTokensUsed.toLocaleString()}`);
    lines.push('');

    // Scores
    lines.push('Scores:');
    lines.push(
      `  Compliance: avg ${analytics.avgComplianceScore.toFixed(2)} ` +
        `(${analytics.complianceDistribution.min.toFixed(2)}-${analytics.complianceDistribution.max.toFixed(2)})`
    );
    lines.push(
      `  Reader: avg ${analytics.avgReaderScore.toFixed(2)} ` +
        `(${analytics.readerDistribution.min.toFixed(2)}-${analytics.readerDistribution.max.toFixed(2)})`
    );
    lines.push('');

    // By Emotion
    if (analytics.byEmotion.size > 0) {
      lines.push('By Emotion:');
      for (const [emotion, stats] of analytics.byEmotion) {
        lines.push(
          `  ${emotion}: ${stats.count} tasks, ` +
            `${(stats.successRate * 100).toFixed(0)}% success, ` +
            `avg ${stats.avgComplianceScore.toFixed(2)}`
        );
      }
      lines.push('');
    }

    // By Timeline
    if (analytics.byTimeline.size > 0) {
      lines.push('By Timeline:');
      for (const [timeline, stats] of analytics.byTimeline) {
        lines.push(
          `  ${timeline}: ${stats.count} tasks, ` +
            `${(stats.successRate * 100).toFixed(0)}% success, ` +
            `avg ${stats.avgComplianceScore.toFixed(2)}`
        );
      }
      lines.push('');
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return lines.join('\n');
  }

  generateJsonReport(result: BatchResult, analytics: BatchAnalytics): JsonReport {
    const byEmotion: Array<{ emotion: string } & GroupStats> = [];
    for (const [emotion, stats] of analytics.byEmotion) {
      byEmotion.push({ emotion, ...stats });
    }

    const byTimeline: Array<{ timeline: string } & GroupStats> = [];
    for (const [timeline, stats] of analytics.byTimeline) {
      byTimeline.push({ timeline, ...stats });
    }

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalTasks: result.totalTasks,
        completed: result.completed,
        failed: result.failed,
        skipped: result.skipped,
        totalTokensUsed: result.totalTokensUsed,
      },
      analytics: {
        successRate: analytics.successRate,
        avgComplianceScore: analytics.avgComplianceScore,
        avgReaderScore: analytics.avgReaderScore,
        complianceDistribution: analytics.complianceDistribution,
        readerDistribution: analytics.readerDistribution,
        byEmotion,
        byTimeline,
      },
    };
  }
}
