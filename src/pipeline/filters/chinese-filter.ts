/**
 * Post-processing filter that removes Chinese character contamination from generated text.
 * This is a safety net applied after all generation/correction stages.
 *
 * Unlike the compliance rule (which detects violations), this filter silently removes
 * Chinese text patterns that occasionally leak from the LLM.
 */

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

export function filterChineseContamination(text: string): string {
  if (!text) return text;

  let result = text;
  for (const pattern of CHINESE_SPECIFIC_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, '');
  }

  // Clean up any leftover double spaces or empty lines from removal
  result = result.replace(/  +/g, ' ');
  result = result.replace(/\n\n\n+/g, '\n\n');

  return result;
}
