import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../template/composer.js';

describe('moderator YAML template', () => {
  it('should render system prompt with soul name and writer entries', () => {
    const context = {
      soulName: 'わたしのライオン',
      writerEntries: [
        { id: 'writer_1', name: '静寂の語り手', focusCategories: 'opening, introspection' },
        { id: 'writer_2', name: '対話の職人', focusCategories: 'dialogue, character_voice' },
      ],
      voiceEntries: [
        { name: '御鐘透心', style: '冷徹だが内面は激情。短文主体' },
      ],
      constitutionSummaryText: '一人称視点を維持。禁止語彙あり。',
    };

    const result = buildPrompt('moderator', context);

    expect(result.system).toContain('わたしのライオン');
    expect(result.system).toContain('モデレーター');
    expect(result.system).toContain('writer_1');
    expect(result.system).toContain('静寂の語り手');
    expect(result.system).toContain('御鐘透心');
    expect(result.system).toContain('JSON形式');
    expect(result.system).toContain('nextPhase');
    expect(result.system).toContain('consensusScore');
  });

  it('should render user prompt with round info and actions', () => {
    const context = {
      soulName: 'わたしのライオン',
      writerEntries: [],
      roundNumber: 2,
      currentPhase: 'discussion',
      actionEntries: [
        { type: 'proposal', writerId: 'writer_1', summary: '冒頭を透心の独白から始める提案' },
        { type: 'feedback', writerId: 'writer_2', summary: 'writer_1の提案に賛成、ただし短文で' },
      ],
      sectionAssignmentEntries: [
        { section: 'opening', writerId: 'writer_1' },
      ],
    };

    const result = buildPrompt('moderator', context);

    expect(result.user).toContain('ラウンド 2');
    expect(result.user).toContain('discussion');
    expect(result.user).toContain('[proposal] writer_1');
    expect(result.user).toContain('[feedback] writer_2');
    expect(result.user).toContain('opening: writer_1');
  });

  it('should render current drafts when present', () => {
    const context = {
      soulName: 'test',
      writerEntries: [],
      roundNumber: 3,
      currentPhase: 'review',
      actionEntries: [],
      currentDraftEntries: [
        { section: 'opening', text: '透心は窓の外を見つめていた。' },
      ],
    };

    const result = buildPrompt('moderator', context);

    expect(result.user).toContain('透心は窓の外を見つめていた。');
    expect(result.user).toContain('opening');
  });
});
