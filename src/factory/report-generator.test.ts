import { describe, it, expect } from 'vitest';
import { ReportGenerator } from './report-generator.js';
import type { BatchAnalytics } from './analytics.js';
import type { BatchResult } from './batch-runner.js';

describe('ReportGenerator', () => {
  const createMockAnalytics = (overrides: Partial<BatchAnalytics> = {}): BatchAnalytics => ({
    successRate: 0.9,
    avgComplianceScore: 0.92,
    avgReaderScore: 0.88,
    complianceDistribution: { min: 0.85, max: 0.98, median: 0.92 },
    readerDistribution: { min: 0.80, max: 0.95, median: 0.88 },
    byEmotion: new Map([
      ['孤独', { count: 5, successRate: 0.8, avgComplianceScore: 0.90, avgReaderScore: 0.85 }],
      ['渇望', { count: 3, successRate: 1.0, avgComplianceScore: 0.95, avgReaderScore: 0.92 }],
    ]),
    byTimeline: new Map([
      ['出会い前', { count: 4, successRate: 0.75, avgComplianceScore: 0.88, avgReaderScore: 0.84 }],
      ['出会い', { count: 4, successRate: 1.0, avgComplianceScore: 0.96, avgReaderScore: 0.92 }],
    ]),
    totalTokensUsed: 100000,
    ...overrides,
  });

  const createMockBatchResult = (): BatchResult => ({
    totalTasks: 10,
    completed: 9,
    failed: 1,
    skipped: 0,
    totalTokensUsed: 100000,
    results: [],
  });

  describe('generateCliReport', () => {
    it('should include success rate', () => {
      const reporter = new ReportGenerator();
      const report = reporter.generateCliReport(createMockAnalytics());

      expect(report).toContain('90.0%');
    });

    it('should include compliance score stats', () => {
      const reporter = new ReportGenerator();
      const report = reporter.generateCliReport(createMockAnalytics());

      expect(report).toContain('Compliance');
      expect(report).toContain('0.92');
    });

    it('should include reader score stats', () => {
      const reporter = new ReportGenerator();
      const report = reporter.generateCliReport(createMockAnalytics());

      expect(report).toContain('Reader');
      expect(report).toContain('0.88');
    });

    it('should include emotion breakdown', () => {
      const reporter = new ReportGenerator();
      const report = reporter.generateCliReport(createMockAnalytics());

      expect(report).toContain('孤独');
      expect(report).toContain('渇望');
    });

    it('should include timeline breakdown', () => {
      const reporter = new ReportGenerator();
      const report = reporter.generateCliReport(createMockAnalytics());

      expect(report).toContain('出会い前');
      expect(report).toContain('出会い');
    });

    it('should include token count', () => {
      const reporter = new ReportGenerator();
      const report = reporter.generateCliReport(createMockAnalytics());

      expect(report).toContain('100,000');
    });
  });

  describe('generateJsonReport', () => {
    it('should include batch result summary', () => {
      const reporter = new ReportGenerator();
      const json = reporter.generateJsonReport(createMockBatchResult(), createMockAnalytics());

      expect(json.summary.totalTasks).toBe(10);
      expect(json.summary.completed).toBe(9);
      expect(json.summary.failed).toBe(1);
    });

    it('should include analytics data', () => {
      const reporter = new ReportGenerator();
      const json = reporter.generateJsonReport(createMockBatchResult(), createMockAnalytics());

      expect(json.analytics.successRate).toBe(0.9);
      expect(json.analytics.avgComplianceScore).toBe(0.92);
    });

    it('should include emotion stats as array', () => {
      const reporter = new ReportGenerator();
      const json = reporter.generateJsonReport(createMockBatchResult(), createMockAnalytics());

      expect(json.analytics.byEmotion).toHaveLength(2);
      expect(json.analytics.byEmotion[0].emotion).toBe('孤独');
    });

    it('should include timeline stats as array', () => {
      const reporter = new ReportGenerator();
      const json = reporter.generateJsonReport(createMockBatchResult(), createMockAnalytics());

      expect(json.analytics.byTimeline).toHaveLength(2);
    });

    it('should include timestamp', () => {
      const reporter = new ReportGenerator();
      const json = reporter.generateJsonReport(createMockBatchResult(), createMockAnalytics());

      expect(json.timestamp).toBeDefined();
      expect(typeof json.timestamp).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle empty emotion/timeline maps', () => {
      const reporter = new ReportGenerator();
      const analytics = createMockAnalytics({
        byEmotion: new Map(),
        byTimeline: new Map(),
      });
      const report = reporter.generateCliReport(analytics);

      expect(report).toBeDefined();
    });

    it('should handle zero success rate', () => {
      const reporter = new ReportGenerator();
      const analytics = createMockAnalytics({ successRate: 0 });
      const report = reporter.generateCliReport(analytics);

      expect(report).toContain('0.0%');
    });
  });
});
