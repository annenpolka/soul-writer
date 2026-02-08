import { describe, it, expect } from 'vitest';
import type {
  TextWeakness,
  AxisComment,
  SectionAnalysis,
  JudgeResult,
} from '../../src/agents/types.js';

describe('TextWeakness interface', () => {
  it('should have category, description, suggestedFix, severity', () => {
    const weakness: TextWeakness = {
      category: 'style',
      description: 'Too many long sentences',
      suggestedFix: 'Break into shorter sentences',
      severity: 'major',
    };
    expect(weakness.category).toBe('style');
    expect(weakness.description).toBe('Too many long sentences');
    expect(weakness.suggestedFix).toBe('Break into shorter sentences');
    expect(weakness.severity).toBe('major');
  });

  it('should accept all valid categories', () => {
    const categories: TextWeakness['category'][] = [
      'style', 'voice', 'pacing', 'imagery', 'motif', 'worldbuilding', 'agency', 'stakes',
    ];
    for (const category of categories) {
      const w: TextWeakness = {
        category,
        description: 'test',
        suggestedFix: 'test',
        severity: 'minor',
      };
      expect(w.category).toBe(category);
    }
  });

  it('should accept all valid severities', () => {
    const severities: TextWeakness['severity'][] = ['critical', 'major', 'minor'];
    for (const severity of severities) {
      const w: TextWeakness = {
        category: 'style',
        description: 'test',
        suggestedFix: 'test',
        severity,
      };
      expect(w.severity).toBe(severity);
    }
  });
});

describe('AxisComment interface', () => {
  it('should have axis, commentA, commentB with optional examples', () => {
    const comment: AxisComment = {
      axis: 'style',
      commentA: 'Text A has good rhythm',
      commentB: 'Text B lacks consistency',
      exampleA: 'some excerpt from A',
      exampleB: 'some excerpt from B',
    };
    expect(comment.axis).toBe('style');
    expect(comment.commentA).toBe('Text A has good rhythm');
    expect(comment.commentB).toBe('Text B lacks consistency');
    expect(comment.exampleA).toBe('some excerpt from A');
    expect(comment.exampleB).toBe('some excerpt from B');
  });

  it('should work without optional examples', () => {
    const comment: AxisComment = {
      axis: 'originality',
      commentA: 'A is novel',
      commentB: 'B is conventional',
    };
    expect(comment.exampleA).toBeUndefined();
    expect(comment.exampleB).toBeUndefined();
  });

  it('should accept all valid axes', () => {
    const axes: AxisComment['axis'][] = [
      'style', 'voice_accuracy', 'originality',
      'structure', 'amplitude', 'agency', 'stakes', 'compliance',
    ];
    for (const axis of axes) {
      const c: AxisComment = { axis, commentA: 'a', commentB: 'b' };
      expect(c.axis).toBe(axis);
    }
  });
});

describe('SectionAnalysis interface', () => {
  it('should have section, ratings, and comments for A and B', () => {
    const analysis: SectionAnalysis = {
      section: 'introduction',
      ratingA: 'excellent',
      ratingB: 'good',
      commentA: 'Strong opening hook',
      commentB: 'Adequate but predictable',
    };
    expect(analysis.section).toBe('introduction');
    expect(analysis.ratingA).toBe('excellent');
    expect(analysis.ratingB).toBe('good');
    expect(analysis.commentA).toBe('Strong opening hook');
    expect(analysis.commentB).toBe('Adequate but predictable');
  });

  it('should accept all valid ratings', () => {
    const ratings: SectionAnalysis['ratingA'][] = ['excellent', 'good', 'adequate', 'weak'];
    for (const rating of ratings) {
      const s: SectionAnalysis = {
        section: 'test',
        ratingA: rating,
        ratingB: rating,
        commentA: 'a',
        commentB: 'b',
      };
      expect(s.ratingA).toBe(rating);
    }
  });
});

describe('JudgeResult enhanced fields', () => {
  it('should accept weaknesses as optional field', () => {
    const result: JudgeResult = {
      winner: 'A',
      reasoning: 'A is better',
      scores: {
        A: { style: 0.8, compliance: 0.9, overall: 0.85 },
        B: { style: 0.7, compliance: 0.8, overall: 0.75 },
      },
      weaknesses: {
        A: [{ category: 'pacing', description: 'Slow middle section', suggestedFix: 'Tighten pacing', severity: 'minor' }],
        B: [{ category: 'voice', description: 'Inconsistent narrator voice', suggestedFix: 'Maintain first-person tone', severity: 'major' }],
      },
    };
    expect(result.weaknesses?.A).toHaveLength(1);
    expect(result.weaknesses?.B[0].category).toBe('voice');
  });

  it('should accept axis_comments as optional field', () => {
    const result: JudgeResult = {
      winner: 'A',
      reasoning: 'A is better',
      scores: {
        A: { style: 0.8, compliance: 0.9, overall: 0.85 },
        B: { style: 0.7, compliance: 0.8, overall: 0.75 },
      },
      axis_comments: [
        { axis: 'style', commentA: 'Good style', commentB: 'Decent style' },
        { axis: 'originality', commentA: 'Fresh', commentB: 'Conventional', exampleA: 'excerpt' },
      ],
    };
    expect(result.axis_comments).toHaveLength(2);
    expect(result.axis_comments![0].axis).toBe('style');
  });

  it('should accept section_analysis as optional field', () => {
    const result: JudgeResult = {
      winner: 'B',
      reasoning: 'B is better',
      scores: {
        A: { style: 0.6, compliance: 0.7, overall: 0.65 },
        B: { style: 0.8, compliance: 0.9, overall: 0.85 },
      },
      section_analysis: [
        { section: 'introduction', ratingA: 'good', ratingB: 'excellent', commentA: 'Solid', commentB: 'Outstanding' },
        { section: 'climax', ratingA: 'adequate', ratingB: 'good', commentA: 'Flat', commentB: 'Gripping' },
      ],
    };
    expect(result.section_analysis).toHaveLength(2);
    expect(result.section_analysis![0].ratingB).toBe('excellent');
  });

  it('should work without any enhanced fields (backward compatible)', () => {
    const result: JudgeResult = {
      winner: 'A',
      reasoning: 'reason',
      scores: {
        A: { style: 0.5, compliance: 0.5, overall: 0.5 },
        B: { style: 0.5, compliance: 0.5, overall: 0.5 },
      },
    };
    expect(result.weaknesses).toBeUndefined();
    expect(result.axis_comments).toBeUndefined();
    expect(result.section_analysis).toBeUndefined();
  });
});
