import type { BatchResult, TaskResult } from './batch-runner.js';

export interface GroupStats {
  count: number;
  successRate: number;
  compliancePassRate: number;
  verdictDistribution: Record<string, number>;
}

export interface BatchAnalytics {
  successRate: number;
  compliancePassRate: number;
  verdictDistribution: Record<string, number>;
  byEmotion: Map<string, GroupStats>;
  byTimeline: Map<string, GroupStats>;
  totalTokensUsed: number;
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
  const compliancePassed = completed.filter((t) => t.compliancePass === true).length;
  const verdictDist: Record<string, number> = {};
  for (const t of completed) {
    if (t.verdictLevel) {
      verdictDist[t.verdictLevel] = (verdictDist[t.verdictLevel] || 0) + 1;
    }
  }

  return {
    count: tasks.length,
    successRate: tasks.length > 0 ? completed.length / tasks.length : 0,
    compliancePassRate: completed.length > 0 ? compliancePassed / completed.length : 0,
    verdictDistribution: verdictDist,
  };
}

export function calculateAnalytics(result: BatchResult): BatchAnalytics {
  const { results } = result;

  if (results.length === 0) {
    return {
      successRate: 0,
      compliancePassRate: 0,
      verdictDistribution: {},
      byEmotion: new Map(),
      byTimeline: new Map(),
      totalTokensUsed: result.totalTokensUsed,
    };
  }

  const completed = results.filter((r) => r.status === 'completed');
  const successRate = results.length > 0 ? completed.length / results.length : 0;

  const compliancePassed = completed.filter((r) => r.compliancePass === true).length;
  const compliancePassRate = completed.length > 0 ? compliancePassed / completed.length : 0;

  const verdictDistribution: Record<string, number> = {};
  for (const r of completed) {
    if (r.verdictLevel) {
      verdictDistribution[r.verdictLevel] = (verdictDistribution[r.verdictLevel] || 0) + 1;
    }
  }

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
    compliancePassRate,
    verdictDistribution,
    byEmotion,
    byTimeline,
    totalTokensUsed: result.totalTokensUsed,
  };
}
