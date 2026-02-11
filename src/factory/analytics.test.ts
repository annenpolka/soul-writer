import { describe, it, expect } from 'vitest';
import { calculateAnalytics } from './analytics.js';
import type { BatchResult, TaskResult } from './batch-runner.js';

describe('calculateAnalytics', () => {
  const createTaskResult = (overrides: Partial<TaskResult> = {}): TaskResult => ({
    taskId: 'task-1',
    themeId: 'theme-1',
    status: 'completed',
    tokensUsed: 1000,
    compliancePass: true,
    verdictLevel: 'publishable',
    emotion: '孤独',
    timeline: '出会い前',
    ...overrides,
  });

  const createBatchResult = (results: TaskResult[]): BatchResult => ({
    totalTasks: results.length,
    completed: results.filter((r) => r.status === 'completed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    totalTokensUsed: results.reduce((sum, r) => sum + (r.tokensUsed ?? 0), 0),
    results,
  });

  describe('success rate', () => {
    it('should calculate success rate correctly', () => {
      const results = [
        createTaskResult({ status: 'completed' }),
        createTaskResult({ status: 'completed' }),
        createTaskResult({ status: 'failed' }),
        createTaskResult({ status: 'completed' }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.successRate).toBe(0.75);
    });

    it('should return 0 for all failed tasks', () => {
      const results = [
        createTaskResult({ status: 'failed' }),
        createTaskResult({ status: 'failed' }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.successRate).toBe(0);
    });

    it('should return 1 for all completed tasks', () => {
      const results = [
        createTaskResult({ status: 'completed' }),
        createTaskResult({ status: 'completed' }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.successRate).toBe(1);
    });
  });

  describe('compliance pass rate', () => {
    it('should calculate compliance pass rate', () => {
      const results = [
        createTaskResult({ compliancePass: true }),
        createTaskResult({ compliancePass: true }),
        createTaskResult({ compliancePass: false }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.compliancePassRate).toBeCloseTo(0.667, 2);
    });

    it('should ignore failed tasks', () => {
      const results = [
        createTaskResult({ status: 'completed', compliancePass: true }),
        createTaskResult({ status: 'failed', compliancePass: undefined }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.compliancePassRate).toBe(1);
    });
  });

  describe('verdict distribution', () => {
    it('should count verdicts across tasks', () => {
      const results = [
        createTaskResult({ verdictLevel: 'publishable' }),
        createTaskResult({ verdictLevel: 'publishable' }),
        createTaskResult({ verdictLevel: 'exceptional' }),
        createTaskResult({ verdictLevel: 'acceptable' }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.verdictDistribution['publishable']).toBe(2);
      expect(analytics.verdictDistribution['exceptional']).toBe(1);
      expect(analytics.verdictDistribution['acceptable']).toBe(1);
    });
  });

  describe('by emotion', () => {
    it('should group stats by emotion', () => {
      const results = [
        createTaskResult({ emotion: '孤独', compliancePass: true, verdictLevel: 'publishable' }),
        createTaskResult({ emotion: '孤独', compliancePass: false, verdictLevel: 'acceptable' }),
        createTaskResult({ emotion: '渇望', compliancePass: true, verdictLevel: 'exceptional' }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.byEmotion.get('孤独')?.count).toBe(2);
      expect(analytics.byEmotion.get('孤独')?.compliancePassRate).toBe(0.5);
      expect(analytics.byEmotion.get('渇望')?.count).toBe(1);
      expect(analytics.byEmotion.get('渇望')?.compliancePassRate).toBe(1);
    });

    it('should calculate success rate per emotion', () => {
      const results = [
        createTaskResult({ emotion: '孤独', status: 'completed' }),
        createTaskResult({ emotion: '孤独', status: 'failed' }),
        createTaskResult({ emotion: '渇望', status: 'completed' }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.byEmotion.get('孤独')?.successRate).toBe(0.5);
      expect(analytics.byEmotion.get('渇望')?.successRate).toBe(1);
    });
  });

  describe('by timeline', () => {
    it('should group stats by timeline', () => {
      const results = [
        createTaskResult({ timeline: '出会い前', verdictLevel: 'publishable' }),
        createTaskResult({ timeline: '出会い', verdictLevel: 'publishable' }),
        createTaskResult({ timeline: '出会い', verdictLevel: 'exceptional' }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.byTimeline.get('出会い前')?.count).toBe(1);
      expect(analytics.byTimeline.get('出会い')?.count).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty results', () => {
      const analytics = calculateAnalytics(createBatchResult([]));

      expect(analytics.successRate).toBe(0);
      expect(analytics.compliancePassRate).toBe(0);
      expect(Object.keys(analytics.verdictDistribution)).toHaveLength(0);
      expect(analytics.byEmotion.size).toBe(0);
      expect(analytics.byTimeline.size).toBe(0);
    });

    it('should handle results without verdict fields', () => {
      const results = [
        createTaskResult({ status: 'failed', compliancePass: undefined, verdictLevel: undefined }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.compliancePassRate).toBe(0);
      expect(Object.keys(analytics.verdictDistribution)).toHaveLength(0);
    });
  });
});
