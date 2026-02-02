import { describe, it, expect, vi } from 'vitest';
import { MotifAnalyzerAgent } from './motif-analyzer.js';
import type { LLMClient } from '../llm/types.js';
import type { Work } from '../storage/work-repository.js';

const works: Work[] = [{
  id: 'w1',
  soulId: 's1',
  title: 'テスト作品',
  content: '短い内容',
  totalChapters: 1,
  totalTokens: 100,
  complianceScore: null,
  readerScore: null,
  status: 'completed',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}];

describe('MotifAnalyzerAgent', () => {
  it('should use tool calling for motif analysis', async () => {
    const toolArgs = { frequent_motifs: ['孤独', '無関心'] };
    const llm: LLMClient = {
      complete: vi.fn().mockResolvedValue('ignored text'),
      completeWithTools: vi.fn().mockResolvedValue({
        toolCalls: [{
          id: 'tc-1',
          type: 'function',
          function: {
            name: 'submit_motif_analysis',
            arguments: JSON.stringify(toolArgs),
          },
        }],
        content: null,
        tokensUsed: 50,
      }),
      getTotalTokens: vi.fn().mockReturnValue(100),
    };

    const agent = new MotifAnalyzerAgent(llm);
    const result = await agent.analyze(works);

    expect(llm.completeWithTools).toHaveBeenCalledTimes(1);
    expect(result.frequentMotifs).toEqual(['孤独', '無関心']);
  });
});
