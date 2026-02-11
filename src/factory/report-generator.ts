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
    compliancePassRate: number;
    verdictDistribution: Record<string, number>;
    byEmotion: Array<{ emotion: string } & GroupStats>;
    byTimeline: Array<{ timeline: string } & GroupStats>;
  };
}

// =====================
// FP API — pure functions
// =====================

function formatVerdictDistribution(dist: Record<string, number>): string {
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return 'N/A';
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

export function generateCliReport(analytics: BatchAnalytics): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('📊 Detailed Report');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  lines.push('Overview:');
  lines.push(`  Success Rate: ${(analytics.successRate * 100).toFixed(1)}%`);
  lines.push(`  Total Tokens: ${analytics.totalTokensUsed.toLocaleString()}`);
  lines.push('');

  lines.push('Quality:');
  lines.push(`  Compliance Pass Rate: ${(analytics.compliancePassRate * 100).toFixed(1)}%`);
  lines.push(`  Verdict Distribution: ${formatVerdictDistribution(analytics.verdictDistribution)}`);
  lines.push('');

  if (analytics.byEmotion.size > 0) {
    lines.push('By Emotion:');
    for (const [emotion, stats] of analytics.byEmotion) {
      lines.push(
        `  ${emotion}: ${stats.count} tasks, ` +
          `${(stats.successRate * 100).toFixed(0)}% success, ` +
          `compliance ${(stats.compliancePassRate * 100).toFixed(0)}%`
      );
    }
    lines.push('');
  }

  if (analytics.byTimeline.size > 0) {
    lines.push('By Timeline:');
    for (const [timeline, stats] of analytics.byTimeline) {
      lines.push(
        `  ${timeline}: ${stats.count} tasks, ` +
          `${(stats.successRate * 100).toFixed(0)}% success, ` +
          `compliance ${(stats.compliancePassRate * 100).toFixed(0)}%`
      );
    }
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return lines.join('\n');
}

export function generateJsonReport(result: BatchResult, analytics: BatchAnalytics): JsonReport {
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
      compliancePassRate: analytics.compliancePassRate,
      verdictDistribution: analytics.verdictDistribution,
      byEmotion,
      byTimeline,
    },
  };
}


