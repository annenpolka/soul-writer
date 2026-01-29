import { describe, it, expect } from 'vitest';
import { calculateAnalytics, type BatchAnalytics } from './analytics.js';
import type { BatchResult, TaskResult } from './batch-runner.js';

describe('calculateAnalytics', () => {
  const createTaskResult = (overrides: Partial<TaskResult> = {}): TaskResult => ({
    taskId: 'task-1',
    themeId: 'theme-1',
    status: 'completed',
    tokensUsed: 1000,
    complianceScore: 0.9,
    readerScore: 0.85,
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

  describe('score averages', () => {
    it('should calculate average compliance score', () => {
      const results = [
        createTaskResult({ complianceScore: 0.8 }),
        createTaskResult({ complianceScore: 0.9 }),
        createTaskResult({ complianceScore: 1.0 }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.avgComplianceScore).toBeCloseTo(0.9, 2);
    });

    it('should calculate average reader score', () => {
      const results = [
        createTaskResult({ readerScore: 0.7 }),
        createTaskResult({ readerScore: 0.8 }),
        createTaskResult({ readerScore: 0.9 }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.avgReaderScore).toBeCloseTo(0.8, 2);
    });

    it('should ignore failed tasks in score calculation', () => {
      const results = [
        createTaskResult({ status: 'completed', complianceScore: 0.9 }),
        createTaskResult({ status: 'failed', complianceScore: undefined }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.avgComplianceScore).toBe(0.9);
    });
  });

  describe('score distribution', () => {
    it('should calculate min, max, median for compliance', () => {
      const results = [
        createTaskResult({ complianceScore: 0.7 }),
        createTaskResult({ complianceScore: 0.8 }),
        createTaskResult({ complianceScore: 0.9 }),
        createTaskResult({ complianceScore: 1.0 }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.complianceDistribution.min).toBeCloseTo(0.7, 2);
      expect(analytics.complianceDistribution.max).toBeCloseTo(1.0, 2);
      expect(analytics.complianceDistribution.median).toBeCloseTo(0.85, 2);
    });

    it('should handle odd number of scores for median', () => {
      const results = [
        createTaskResult({ complianceScore: 0.7 }),
        createTaskResult({ complianceScore: 0.8 }),
        createTaskResult({ complianceScore: 0.9 }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.complianceDistribution.median).toBe(0.8);
    });
  });

  describe('by emotion', () => {
    it('should group stats by emotion', () => {
      const results = [
        createTaskResult({ emotion: '孤独', complianceScore: 0.9 }),
        createTaskResult({ emotion: '孤独', complianceScore: 0.8 }),
        createTaskResult({ emotion: '渇望', complianceScore: 0.95 }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.byEmotion.get('孤独')?.count).toBe(2);
      expect(analytics.byEmotion.get('孤独')?.avgComplianceScore).toBeCloseTo(0.85, 2);
      expect(analytics.byEmotion.get('渇望')?.count).toBe(1);
      expect(analytics.byEmotion.get('渇望')?.avgComplianceScore).toBe(0.95);
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
        createTaskResult({ timeline: '出会い前', complianceScore: 0.9 }),
        createTaskResult({ timeline: '出会い', complianceScore: 0.85 }),
        createTaskResult({ timeline: '出会い', complianceScore: 0.95 }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.byTimeline.get('出会い前')?.count).toBe(1);
      expect(analytics.byTimeline.get('出会い')?.count).toBe(2);
      expect(analytics.byTimeline.get('出会い')?.avgComplianceScore).toBeCloseTo(0.9, 2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty results', () => {
      const analytics = calculateAnalytics(createBatchResult([]));

      expect(analytics.successRate).toBe(0);
      expect(analytics.avgComplianceScore).toBe(0);
      expect(analytics.avgReaderScore).toBe(0);
      expect(analytics.byEmotion.size).toBe(0);
      expect(analytics.byTimeline.size).toBe(0);
    });

    it('should handle results without scores', () => {
      const results = [
        createTaskResult({ status: 'failed', complianceScore: undefined, readerScore: undefined }),
      ];
      const analytics = calculateAnalytics(createBatchResult(results));

      expect(analytics.avgComplianceScore).toBe(0);
      expect(analytics.avgReaderScore).toBe(0);
    });
  });
});
