import { describe, it, expect } from 'vitest';
import type {
  DefectSeverity,
  Defect,
  DefectDetectorResult,
  DefectDetectorDeps,
  DefectDetectorFn,
  AgentDeps,
} from '../../src/agents/types.js';

describe('DefectDetector Types', () => {
  it('DefectSeverity should accept critical, major, minor', () => {
    const severities: DefectSeverity[] = ['critical', 'major', 'minor'];
    expect(severities).toHaveLength(3);
    expect(severities).toContain('critical');
    expect(severities).toContain('major');
    expect(severities).toContain('minor');
  });

  it('Defect should have required fields', () => {
    const defect: Defect = {
      severity: 'critical',
      category: 'character_inconsistency',
      description: 'Character voice breaks',
    };
    expect(defect.severity).toBe('critical');
    expect(defect.category).toBe('character_inconsistency');
    expect(defect.description).toBe('Character voice breaks');
    expect(defect.location).toBeUndefined();
  });

  it('Defect should accept optional location', () => {
    const defect: Defect = {
      severity: 'major',
      category: 'pacing',
      description: 'Too slow',
      location: 'Chapter 2, paragraph 3',
    };
    expect(defect.location).toBe('Chapter 2, paragraph 3');
  });

  it('DefectDetectorResult should have all required fields', () => {
    const result: DefectDetectorResult = {
      defects: [],
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      passed: true,
      feedback: 'No defects found',
    };
    expect(result.defects).toEqual([]);
    expect(result.criticalCount).toBe(0);
    expect(result.majorCount).toBe(0);
    expect(result.minorCount).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.feedback).toBe('No defects found');
  });

  it('DefectDetectorResult should contain counted defects', () => {
    const defects: Defect[] = [
      { severity: 'critical', category: 'plot', description: 'Plot hole' },
      { severity: 'major', category: 'pacing', description: 'Slow' },
      { severity: 'major', category: 'motif', description: 'Fatigue' },
      { severity: 'minor', category: 'style', description: 'Repetition' },
    ];
    const result: DefectDetectorResult = {
      defects,
      criticalCount: 1,
      majorCount: 2,
      minorCount: 1,
      passed: false,
      feedback: 'Critical defect found',
    };
    expect(result.defects).toHaveLength(4);
    expect(result.criticalCount).toBe(1);
    expect(result.majorCount).toBe(2);
    expect(result.minorCount).toBe(1);
    expect(result.passed).toBe(false);
  });

  it('DefectDetectorDeps should extend AgentDeps', () => {
    const deps: DefectDetectorDeps = {
      llmClient: { complete: async () => '', getTotalTokens: () => 0 },
      soulText: {} as DefectDetectorDeps['soulText'],
    };
    // Verify it has AgentDeps properties
    expect(deps.llmClient).toBeDefined();
    expect(deps.soulText).toBeDefined();
  });

  it('DefectDetectorDeps should accept optional thresholds', () => {
    const deps: DefectDetectorDeps = {
      llmClient: { complete: async () => '', getTotalTokens: () => 0 },
      soulText: {} as DefectDetectorDeps['soulText'],
      maxCriticalDefects: 0,
      maxMajorDefects: 3,
    };
    expect(deps.maxCriticalDefects).toBe(0);
    expect(deps.maxMajorDefects).toBe(3);
  });

  it('DefectDetectorFn should have detect method', () => {
    const fn: DefectDetectorFn = {
      detect: async (_text: string) => ({
        defects: [],
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
        passed: true,
        feedback: 'No defects',
      }),
    };
    expect(fn.detect).toBeInstanceOf(Function);
  });
});
