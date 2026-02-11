import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefectDetector } from '../../src/agents/defect-detector.js';
import type { DefectDetectorDeps } from '../../src/agents/types.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockDefectDetectorDeps(overrides?: {
  toolResponse?: { name: string; arguments: Record<string, unknown> };
  tokenCount?: number;
  maxCriticalDefects?: number;
  maxMajorDefects?: number;
}): DefectDetectorDeps {
  const defaultToolResponse = {
    name: 'submit_defects',
    arguments: {
      verdict_level: 'publishable',
      defects: [
        { severity: 'major', category: 'pacing_issue', description: 'Middle section drags' },
        { severity: 'minor', category: 'style_deviation', description: 'Slight rhythm inconsistency' },
      ],
    },
  };

  return {
    llmClient: createMockLLMClientWithTools(
      overrides?.toolResponse ?? defaultToolResponse,
      overrides?.tokenCount ?? 100,
    ),
    soulText: createMockSoulText(),
    maxCriticalDefects: overrides?.maxCriticalDefects,
    maxMajorDefects: overrides?.maxMajorDefects,
  };
}

describe('createDefectDetector (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a DefectDetectorFn with detect method', () => {
    const deps = createMockDefectDetectorDeps();
    const detector = createDefectDetector(deps);
    expect(detector.detect).toBeInstanceOf(Function);
  });

  it('detect() should call completeWithTools', async () => {
    const deps = createMockDefectDetectorDeps();
    const detector = createDefectDetector(deps);
    await detector.detect('Test text content');
    expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('detect() should pass the text in the user prompt', async () => {
    const deps = createMockDefectDetectorDeps();
    const detector = createDefectDetector(deps);
    await detector.detect('My story text here');
    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    // call[1] is the user prompt
    expect(call[1]).toContain('My story text here');
  });

  it('detect() should return DefectDetectorResult with correct counts', async () => {
    const deps = createMockDefectDetectorDeps();
    const detector = createDefectDetector(deps);
    const result = await detector.detect('Test text');

    expect(result.defects).toHaveLength(2);
    expect(result.criticalCount).toBe(0);
    expect(result.majorCount).toBe(1);
    expect(result.minorCount).toBe(1);
  });

  it('detect() should return passed=true when no critical defects', async () => {
    const deps = createMockDefectDetectorDeps();
    const detector = createDefectDetector(deps);
    const result = await detector.detect('Test text');

    expect(result.passed).toBe(true);
  });

  it('detect() should return passed=false when critical defects exist', async () => {
    const deps = createMockDefectDetectorDeps({
      toolResponse: {
        name: 'submit_defects',
        arguments: {
          verdict_level: 'unacceptable',
          defects: [
            { severity: 'critical', category: 'plot_contradiction', description: 'Major plot hole' },
          ],
        },
      },
    });
    const detector = createDefectDetector(deps);
    const result = await detector.detect('Test text');

    expect(result.passed).toBe(false);
    expect(result.criticalCount).toBe(1);
  });

  it('detect() should return feedback summarizing defects', async () => {
    const deps = createMockDefectDetectorDeps({
      toolResponse: {
        name: 'submit_defects',
        arguments: {
          verdict_level: 'needs_work',
          defects: [
            { severity: 'critical', category: 'plot', description: 'Plot hole found' },
            { severity: 'major', category: 'pacing', description: 'Slow pacing' },
          ],
        },
      },
    });
    const detector = createDefectDetector(deps);
    const result = await detector.detect('Test text');

    expect(result.feedback).toContain('Plot hole found');
    expect(result.feedback).toContain('Slow pacing');
  });

  it('detect() should return passed=true and feedback="欠陥なし" when no defects and publishable verdict', async () => {
    const deps = createMockDefectDetectorDeps({
      toolResponse: {
        name: 'submit_defects',
        arguments: { verdict_level: 'publishable', defects: [] },
      },
    });
    const detector = createDefectDetector(deps);
    const result = await detector.detect('Test text');

    expect(result.passed).toBe(true);
    expect(result.feedback).toBe('欠陥なし');
    expect(result.defects).toEqual([]);
  });

  it('detect() should use submit_defects tool with strict mode', async () => {
    const deps = createMockDefectDetectorDeps();
    const detector = createDefectDetector(deps);
    await detector.detect('Test text');

    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    // call[2] is the tools array
    const tools = call[2] as Array<{ type: string; function: { name: string; strict?: boolean } }>;
    expect(tools).toHaveLength(1);
    expect(tools[0].function.name).toBe('submit_defects');
    expect(tools[0].function.strict).toBe(true);
  });

  it('detect() should use temperature 0.3', async () => {
    const deps = createMockDefectDetectorDeps();
    const detector = createDefectDetector(deps);
    await detector.detect('Test text');

    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    // call[3] is options
    const options = call[3] as { temperature?: number };
    expect(options.temperature).toBe(0.3);
  });
});
