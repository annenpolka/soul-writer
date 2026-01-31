import type { Character } from '../schemas/generated-theme.js';
import type { PromptConfig } from '../schemas/prompt-config.js';

export type PovType = 'first-person' | 'third-person-limited' | 'third-person-omniscient' | 'mixed';

export interface NarrativeRules {
  pov: PovType;
  /** Required pronoun (e.g. 'わたし'), null = no constraint */
  pronoun: string | null;
  /** Protagonist name for third-person, null = no constraint */
  protagonistName: string | null;
  /** Human-readable description for prompt injection */
  povDescription: string;
  /** Whether the default protagonist (透心) is the main character */
  isDefaultProtagonist: boolean;
}

const DEFAULT_PROTAGONIST_SHORT = '透心';

/**
 * Resolve narrative rules from narrative_type and character list.
 * Used by all agents to dynamically adjust POV/pronoun rules.
 */
export function resolveNarrativeRules(
  narrativeType?: string,
  characters?: Character[],
  promptConfig?: PromptConfig,
): NarrativeRules {
  const protagonistShort = promptConfig?.defaults.protagonist_short ?? DEFAULT_PROTAGONIST_SHORT;
  const pronoun = promptConfig?.defaults.pronoun ?? 'わたし';
  const hasDefaultProtagonist = characters
    ? characters.some(c => c.name.includes(protagonistShort) && !c.isNew)
    : true; // assume default if no characters specified

  // Helper to get POV description from prompt-config if available
  const getPovDescription = (key: string, fallback: string): string => {
    return promptConfig?.pov_rules?.[key]?.description ?? fallback;
  };

  // Default: first-person わたし with 透心
  if (!narrativeType) {
    return {
      pov: 'first-person',
      pronoun: hasDefaultProtagonist ? pronoun : null,
      protagonistName: null,
      povDescription: getPovDescription('first-person',
        hasDefaultProtagonist
          ? '一人称（わたし）視点。御鐘透心の内面から語る'
          : '一人称視点。主人公の内面から語る'),
      isDefaultProtagonist: hasDefaultProtagonist,
    };
  }

  if (narrativeType.includes('三人称')) {
    return {
      pov: 'third-person-limited',
      pronoun: null,
      protagonistName: hasDefaultProtagonist ? protagonistShort : null,
      povDescription: getPovDescription('third-person',
        hasDefaultProtagonist
          ? '三人称限定視点。透心を「透心」と呼び、彼女の内面に限定して描写する'
          : '三人称限定視点。主人公を三人称で呼び、その内面に限定して描写する'),
      isDefaultProtagonist: hasDefaultProtagonist,
    };
  }

  if (narrativeType.includes('群像劇')) {
    return {
      pov: 'mixed',
      pronoun: null,
      protagonistName: null,
      povDescription: '群像劇。複数キャラクターの視点を章内でセクション区切りで切り替える',
      isDefaultProtagonist: hasDefaultProtagonist,
    };
  }

  if (narrativeType.includes('書簡') || narrativeType.includes('ログ')) {
    return {
      pov: 'first-person',
      pronoun: null,
      protagonistName: null,
      povDescription: '書簡体またはログ形式。文書・記録の形式で語る。書き手によって人称は変わる',
      isDefaultProtagonist: hasDefaultProtagonist,
    };
  }

  if (narrativeType.includes('断片')) {
    return {
      pov: 'mixed',
      pronoun: null,
      protagonistName: null,
      povDescription: '断片的叙述。一人称と三人称が混在し、記憶の欠落を表現する',
      isDefaultProtagonist: hasDefaultProtagonist,
    };
  }

  if (narrativeType.includes('時系列逆転')) {
    return {
      pov: 'first-person',
      pronoun: hasDefaultProtagonist ? pronoun : null,
      protagonistName: null,
      povDescription: getPovDescription('time-reversal',
        hasDefaultProtagonist
          ? '時系列逆転。一人称（わたし）視点で、結末から遡って語る'
          : '時系列逆転。一人称視点で、結末から遡って語る'),
      isDefaultProtagonist: hasDefaultProtagonist,
    };
  }

  if (narrativeType.includes('反復')) {
    return {
      pov: 'first-person',
      pronoun: hasDefaultProtagonist ? pronoun : null,
      protagonistName: null,
      povDescription: getPovDescription('repetition',
        hasDefaultProtagonist
          ? '反復構造。同じシーンを異なる角度から繰り返し語る。一人称（わたし）視点'
          : '反復構造。同じシーンを異なる角度から繰り返し語る'),
      isDefaultProtagonist: hasDefaultProtagonist,
    };
  }

  // Fallback: first-person
  return {
    pov: 'first-person',
    pronoun: hasDefaultProtagonist ? pronoun : null,
    protagonistName: null,
    povDescription: hasDefaultProtagonist
      ? '一人称（わたし）視点'
      : '一人称視点',
    isDefaultProtagonist: hasDefaultProtagonist,
  };
}

/**
 * Generate POV-related rules for system prompts.
 * Returns an array of rule strings to inject into 【最重要ルール】 sections.
 */
export function buildPovRules(rules: NarrativeRules, promptConfig?: PromptConfig): string[] {
  // If promptConfig has pov_rules for this POV type, use those directly
  const povKey = rules.pov === 'third-person-limited' ? 'third-person' : rules.pov;
  const configRules = promptConfig?.pov_rules?.[povKey]?.rules;
  if (configRules && configRules.length > 0) {
    return configRules.map(r => `- ${r}`);
  }

  const lines: string[] = [];

  if (rules.pov === 'first-person' && rules.pronoun) {
    lines.push(`- 一人称は必ず「${rules.pronoun}」（ひらがな）を使用。「私」「僕」「俺」は禁止`);
    if (rules.isDefaultProtagonist) {
      lines.push('- 視点は御鐘透心の一人称のみ。三人称的な外部描写は禁止');
    } else {
      lines.push('- 主人公の一人称視点を維持。三人称的な外部描写は禁止');
    }
  } else if (rules.pov === 'first-person') {
    // first-person but no fixed pronoun (e.g. 書簡体)
    lines.push('- 一人称視点で語る。書き手に応じた人称を使用');
  } else if (rules.pov === 'third-person-limited') {
    if (rules.protagonistName) {
      lines.push(`- 三人称限定視点で「${rules.protagonistName}」を中心に描写`);
      lines.push(`- 「${rules.protagonistName}」の内面のみ描写可。他キャラの心理は行動・台詞から推測させる`);
    } else {
      lines.push('- 三人称限定視点。主人公の内面のみ描写可');
    }
    lines.push('- 「わたし」等の一人称は地の文で使用禁止（台詞内は可）');
  } else if (rules.pov === 'mixed') {
    lines.push('- 複数視点を使用可。視点切り替え時はセクション区切りを明確に');
    lines.push('- 各セクション内では視点を一貫させる');
  }

  return lines;
}
