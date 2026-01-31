import type { Condition } from './types.js';

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isTruthy(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function evaluateCondition(condition: Condition, context: Record<string, unknown>): boolean {
  if ('has' in condition) {
    return isTruthy(resolvePath(context, condition.has));
  }
  if ('eq' in condition) {
    const [leftPath, right] = condition.eq;
    const leftVal = resolvePath(context, leftPath);
    // Try resolving right as path first, fall back to literal
    const rightVal = resolvePath(context, right);
    if (rightVal !== undefined) {
      return String(leftVal) === String(rightVal);
    }
    return String(leftVal) === right;
  }
  if ('in' in condition) {
    const [valuePath, arrayPath] = condition.in;
    const value = resolvePath(context, valuePath);
    const arr = resolvePath(context, arrayPath);
    if (!Array.isArray(arr)) return false;
    return arr.includes(value);
  }
  if ('and' in condition) {
    return condition.and.every(c => evaluateCondition(c, context));
  }
  if ('or' in condition) {
    return condition.or.some(c => evaluateCondition(c, context));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, context);
  }
  return false;
}
