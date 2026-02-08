import type { Violation } from '../../agents/types.js';
import type { ComplianceRule } from './forbidden-words.js';

const CHINESE_SPECIFIC_PATTERNS: RegExp[] = [
  /(?:并且|并发|并不|并没|并非)/g,
  /(?:因为|所以|虽然|但是|如果|然后)/g,
  /(?:这个|这里|这样|这些|那个|那里|那样)/g,
  /(?:他们|她们|我们|你们)/g,
  /(?:对于|关于|由于)/g,
  /(?:已经|正在|即将|刚才)/g,
  /(?:觉得|认为|发现|发展|发生)/g,
  /(?:还是|或者|而且|不过|可是)/g,
];

function createViolation(match: RegExpMatchArray, text: string): Violation {
  const index = match.index ?? 0;
  const contextStart = Math.max(0, index - 20);
  const contextEnd = Math.min(text.length, index + match[0].length + 20);

  return {
    type: 'chinese_contamination',
    position: {
      start: index,
      end: index + match[0].length,
    },
    context: text.slice(contextStart, contextEnd),
    rule: `Chinese text detected: ${match[0]}`,
    severity: 'error',
  };
}

function checkChineseContamination(text: string): Violation[] {
  const violations: Violation[] = [];

  if (!text) return violations;

  for (const pattern of CHINESE_SPECIFIC_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      violations.push(createViolation(match, text));
    }
  }

  return violations;
}

export function createChineseContaminationRule(): ComplianceRule {
  return {
    name: 'chinese_contamination',
    check: checkChineseContamination,
  };
}
