import type { BatchResult, TaskResult } from './batch-runner.js';

export interface ScoreDistribution {
  min: number;
  max: number;
  median: number;
}

export interface GroupStats {
  count: number;
  successRate: number;
  avgComplianceScore: number;
  avgReaderScore: number;
}

export interface BatchAnalytics {
  successRate: number;
  avgComplianceScore: number;
  avgReaderScore: number;
  complianceDistribution: ScoreDistribution;
  readerDistribution: ScoreDistribution;
  byEmotion: Map<string, GroupStats>;
  byTimeline: Map<string, GroupStats>;
  totalTokensUsed: number;
}

function calculateMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function calculateDistribution(scores: number[]): ScoreDistribution {
  if (scores.length === 0) {
    return { min: 0, max: 0, median: 0 };
  }
  const sorted = [...scores].sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: calculateMedian(sorted),
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (key === undefined) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function calculateGroupStats(tasks: TaskResult[]): GroupStats {
  const completed = tasks.filter((t) => t.status === 'completed');
  const complianceScores = completed
    .map((t) => t.complianceScore)
    .filter((s): s is number => s !== undefined);
  const readerScores = completed
    .map((t) => t.readerScore)
    .filter((s): s is number => s !== undefined);

  return {
    count: tasks.length,
    successRate: tasks.length > 0 ? completed.length / tasks.length : 0,
    avgComplianceScore:
      complianceScores.length > 0
        ? complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length
        : 0,
    avgReaderScore:
      readerScores.length > 0
        ? readerScores.reduce((a, b) => a + b, 0) / readerScores.length
        : 0,
  };
}

export function calculateAnalytics(result: BatchResult): BatchAnalytics {
  const { results } = result;

  if (results.length === 0) {
    return {
      successRate: 0,
      avgComplianceScore: 0,
      avgReaderScore: 0,
      complianceDistribution: { min: 0, max: 0, median: 0 },
      readerDistribution: { min: 0, max: 0, median: 0 },
      byEmotion: new Map(),
      byTimeline: new Map(),
      totalTokensUsed: result.totalTokensUsed,
    };
  }

  const completed = results.filter((r) => r.status === 'completed');
  const successRate = results.length > 0 ? completed.length / results.length : 0;

  const complianceScores = completed
    .map((r) => r.complianceScore)
    .filter((s): s is number => s !== undefined);
  const readerScores = completed
    .map((r) => r.readerScore)
    .filter((s): s is number => s !== undefined);

  const avgComplianceScore =
    complianceScores.length > 0
      ? complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length
      : 0;
  const avgReaderScore =
    readerScores.length > 0
      ? readerScores.reduce((a, b) => a + b, 0) / readerScores.length
      : 0;

  // Group by emotion
  const emotionGroups = groupBy(results, (r) => r.emotion);
  const byEmotion = new Map<string, GroupStats>();
  for (const [emotion, tasks] of emotionGroups) {
    byEmotion.set(emotion, calculateGroupStats(tasks));
  }

  // Group by timeline
  const timelineGroups = groupBy(results, (r) => r.timeline);
  const byTimeline = new Map<string, GroupStats>();
  for (const [timeline, tasks] of timelineGroups) {
    byTimeline.set(timeline, calculateGroupStats(tasks));
  }

  return {
    successRate,
    avgComplianceScore,
    avgReaderScore,
    complianceDistribution: calculateDistribution(complianceScores),
    readerDistribution: calculateDistribution(readerScores),
    byEmotion,
    byTimeline,
    totalTokensUsed: result.totalTokensUsed,
  };
}
