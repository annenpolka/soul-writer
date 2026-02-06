/**
 * FP ReportGenerator Tests
 */
import { describe, it, expect } from 'vitest';
import {
  generateCliReport,
  generateJsonReport,
} from '../../src/factory/report-generator.js';
import type { BatchAnalytics } from '../../src/factory/analytics.js';
import type { BatchResult } from '../../src/factory/batch-runner.js';

const createMockAnalytics = (): BatchAnalytics => ({
  successRate: 0.8,
  avgComplianceScore: 0.85,
  avgReaderScore: 0.78,
  totalTokensUsed: 5000,
  complianceDistribution: { min: 0.7, max: 0.95, median: 0.85 },
  readerDistribution: { min: 0.6, max: 0.9, median: 0.78 },
  byEmotion: new Map([['sadness', { count: 2, successRate: 1.0, avgComplianceScore: 0.9, avgReaderScore: 0.8, totalTokensUsed: 3000 }]]),
  byTimeline: new Map([['past', { count: 2, successRate: 1.0, avgComplianceScore: 0.88, avgReaderScore: 0.82, totalTokensUsed: 3000 }]]),
});

const createMockBatchResult = (): BatchResult => ({
  totalTasks: 5,
  completed: 4,
  failed: 1,
  skipped: 0,
  totalTokensUsed: 5000,
  results: [],
});

describe('generateCliReport (FP)', () => {
  it('should generate a CLI report string', () => {
    const analytics = createMockAnalytics();
    const report = generateCliReport(analytics);
    expect(report).toContain('Detailed Report');
    expect(report).toContain('Success Rate: 80.0%');
    expect(report).toContain('Compliance');
  });

  it('should include emotion breakdown', () => {
    const analytics = createMockAnalytics();
    const report = generateCliReport(analytics);
    expect(report).toContain('sadness');
  });

  it('should include timeline breakdown', () => {
    const analytics = createMockAnalytics();
    const report = generateCliReport(analytics);
    expect(report).toContain('past');
  });
});

describe('generateJsonReport (FP)', () => {
  it('should generate a JSON report', () => {
    const result = createMockBatchResult();
    const analytics = createMockAnalytics();
    const report = generateJsonReport(result, analytics);

    expect(report.summary.totalTasks).toBe(5);
    expect(report.summary.completed).toBe(4);
    expect(report.analytics.successRate).toBe(0.8);
    expect(report.analytics.byEmotion).toHaveLength(1);
    expect(report.analytics.byTimeline).toHaveLength(1);
  });

  it('should include timestamp', () => {
    const result = createMockBatchResult();
    const analytics = createMockAnalytics();
    const report = generateJsonReport(result, analytics);
    expect(report.timestamp).toBeDefined();
  });
});
