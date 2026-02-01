import { describe, it, expect } from 'vitest';
import {
  COLLABORATION_TOOLS,
  getToolByName,
  parseToolCallToAction,
} from './tools.js';
import { CollaborationActionSchema } from './types.js';

describe('COLLABORATION_TOOLS', () => {
  it('should define 4 tools', () => {
    expect(COLLABORATION_TOOLS).toHaveLength(4);
  });

  it('should have correct tool names', () => {
    const names = COLLABORATION_TOOLS.map((t) => t.function.name);
    expect(names).toEqual([
      'submit_proposal',
      'give_feedback',
      'submit_draft',
      'volunteer_section',
    ]);
  });

  it('should all have strict: true', () => {
    for (const tool of COLLABORATION_TOOLS) {
      expect(tool.function.strict).toBe(true);
    }
  });

  it('should all have type: function', () => {
    for (const tool of COLLABORATION_TOOLS) {
      expect(tool.type).toBe('function');
    }
  });

  it('should have JSON Schema parameters with required fields', () => {
    for (const tool of COLLABORATION_TOOLS) {
      const params = tool.function.parameters as any;
      expect(params.type).toBe('object');
      expect(params.properties).toBeDefined();
      expect(params.required).toBeDefined();
      expect(params.required.length).toBeGreaterThan(0);
    }
  });
});

describe('getToolByName', () => {
  it('should return the correct tool', () => {
    const tool = getToolByName('submit_proposal');
    expect(tool?.function.name).toBe('submit_proposal');
  });

  it('should return undefined for unknown tool', () => {
    expect(getToolByName('unknown')).toBeUndefined();
  });
});

describe('parseToolCallToAction', () => {
  it('should parse submit_proposal tool call', () => {
    const action = parseToolCallToAction(
      'writer_1',
      'submit_proposal',
      '{"content":"透心の独白から始める","targetSection":"opening"}',
    );
    expect(action).toEqual({
      type: 'proposal',
      writerId: 'writer_1',
      content: '透心の独白から始める',
      targetSection: 'opening',
    });
    expect(() => CollaborationActionSchema.parse(action)).not.toThrow();
  });

  it('should parse give_feedback tool call', () => {
    const action = parseToolCallToAction(
      'writer_2',
      'give_feedback',
      '{"targetWriterId":"writer_1","feedback":"緊張感が足りない","sentiment":"suggest_revision"}',
    );
    expect(action).toEqual({
      type: 'feedback',
      writerId: 'writer_2',
      targetWriterId: 'writer_1',
      feedback: '緊張感が足りない',
      sentiment: 'suggest_revision',
    });
  });

  it('should parse submit_draft tool call', () => {
    const action = parseToolCallToAction(
      'writer_1',
      'submit_draft',
      '{"section":"opening","text":"透心は窓の外を見つめていた。"}',
    );
    expect(action).toEqual({
      type: 'draft',
      writerId: 'writer_1',
      section: 'opening',
      text: '透心は窓の外を見つめていた。',
    });
  });

  it('should parse volunteer_section tool call', () => {
    const action = parseToolCallToAction(
      'writer_3',
      'volunteer_section',
      '{"section":"climax","reason":"殺害シーンは得意です"}',
    );
    expect(action).toEqual({
      type: 'volunteer',
      writerId: 'writer_3',
      section: 'climax',
      reason: '殺害シーンは得意です',
    });
  });

  it('should throw for unknown tool name', () => {
    expect(() =>
      parseToolCallToAction('w1', 'unknown_tool', '{}'),
    ).toThrow();
  });
});
