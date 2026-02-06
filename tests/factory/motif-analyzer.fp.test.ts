import { describe, it, expect } from 'vitest';
import { createMotifAnalyzer, type MotifAnalyzerFn } from '../../src/factory/motif-analyzer.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import type { Work } from '../../src/storage/work-repository.js';

const sampleWorks: Work[] = [{
  id: 'w1',
  soulId: 's1',
  title: 'テスト作品',
  content: '短い内容',
  totalChapters: 1,
  totalTokens: 100,
  complianceScore: null,
  readerScore: null,
  tone: null,
  status: 'completed',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}];

describe('createMotifAnalyzer (FP)', () => {
  it('should return a MotifAnalyzerFn with analyze method', () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_motif_analysis',
      arguments: { frequent_motifs: [] },
    });
    const analyzer: MotifAnalyzerFn = createMotifAnalyzer(llm);
    expect(typeof analyzer.analyze).toBe('function');
  });

  it('should return empty motifs for empty works array', async () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_motif_analysis',
      arguments: { frequent_motifs: [] },
    });
    const analyzer = createMotifAnalyzer(llm);
    const result = await analyzer.analyze([]);
    expect(result.frequentMotifs).toEqual([]);
    expect(result.tokensUsed).toBe(0);
    expect(llm.completeWithTools).not.toHaveBeenCalled();
  });

  it('should analyze works and return motifs', async () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_motif_analysis',
      arguments: { frequent_motifs: ['孤独', '無関心'] },
    });
    const analyzer = createMotifAnalyzer(llm);
    const result = await analyzer.analyze(sampleWorks);
    expect(result.frequentMotifs).toEqual(['孤独', '無関心']);
    expect(llm.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('should handle parse errors gracefully', async () => {
    const llm = createMockLLMClientWithTools({
      name: 'wrong_tool_name',
      arguments: {},
    });
    const analyzer = createMotifAnalyzer(llm);
    const result = await analyzer.analyze(sampleWorks);
    expect(result.frequentMotifs).toEqual([]);
  });
});
