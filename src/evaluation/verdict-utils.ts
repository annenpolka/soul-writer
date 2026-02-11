import type { VerdictLevel, Defect, TextWeakness } from '../agents/types.js';
import { VERDICT_LEVEL_ORDER } from '../agents/types.js';

export function isVerdictPassing(level: VerdictLevel): boolean {
  return level === 'publishable' || level === 'exceptional';
}

export function verdictToString(level: VerdictLevel): string {
  const labels: Record<VerdictLevel, string> = {
    exceptional: '出版水準超',
    publishable: '出版可能',
    acceptable: '構造的に機能',
    needs_work: '要改善',
    unacceptable: '根本的問題',
  };
  return labels[level];
}

export function compareVerdicts(a: VerdictLevel, b: VerdictLevel): number {
  return VERDICT_LEVEL_ORDER.indexOf(a) - VERDICT_LEVEL_ORDER.indexOf(b);
}

export function buildRetakeFeedback(
  defects: Defect[],
  judgeWeaknesses: TextWeakness[],
  verdictLevel: VerdictLevel,
): string {
  const parts: string[] = [];

  parts.push(`品質判定: ${verdictToString(verdictLevel)} (${verdictLevel})`);
  parts.push('');

  if (judgeWeaknesses.length > 0) {
    parts.push('--- Judge分析からの弱点 ---');
    for (const w of judgeWeaknesses) {
      parts.push(`[${w.severity}/${w.category}] ${w.description}`);
      if (w.suggestedFix) parts.push(`  → 修正案: ${w.suggestedFix}`);
    }
    parts.push('');
  }

  if (defects.length > 0) {
    parts.push('--- 検出された欠陥 ---');
    for (const d of defects) {
      parts.push(`[${d.severity}/${d.category}] ${d.description}`);
      if (d.suggestedFix) parts.push(`  → 修正案: ${d.suggestedFix}`);
    }
  }

  return parts.join('\n');
}
