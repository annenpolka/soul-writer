type FilterValue = string | string[] | unknown;

interface ParsedFilter {
  name: string;
  arg: string;
}

function parseFilterChain(expr: string): ParsedFilter[] {
  return expr.split(/\s*\|\s*/).map(part => {
    const match = part.match(/^(\w+):\s*"((?:[^"\\]|\\.)*)"/);
    if (!match) return { name: part.trim(), arg: '' };
    return { name: match[1], arg: match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"') };
  });
}

function applySingleFilter(value: FilterValue, filter: ParsedFilter): FilterValue {
  switch (filter.name) {
    case 'join': {
      if (Array.isArray(value)) return value.join(filter.arg);
      return String(value);
    }
    case 'prefix': {
      if (Array.isArray(value)) return value.map(v => `${filter.arg}${v}`);
      return `${filter.arg}${value}`;
    }
    case 'tag': {
      return `${filter.arg} ${value}`;
    }
    default:
      return value;
  }
}

export function applyFilter(value: FilterValue, filterExpr: string): FilterValue {
  const filters = parseFilterChain(filterExpr);
  let current = value;
  for (const f of filters) {
    current = applySingleFilter(current, f);
  }
  return current;
}
