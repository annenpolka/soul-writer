#!/usr/bin/env bash
# find-past-works.sh — output/ ディレクトリから過去の story.txt を検索
# Usage: bash find-past-works.sh [output-dir]
# Output: JSON array of file paths to stdout
# Exit: 0 = files found, 1 = no files found

set -uo pipefail

OUTPUT_DIR="${1:-output}"

if [ ! -d "$OUTPUT_DIR" ]; then
  echo '[]'
  exit 1
fi

FILES=()
while IFS= read -r f; do
  [ -f "$f" ] && FILES+=("$f")
done < <(find "$OUTPUT_DIR" -name "story.txt" -type f 2>/dev/null | sort -r)

if [ ${#FILES[@]} -eq 0 ]; then
  echo '[]'
  exit 1
fi

# Build JSON array
JSON="["
for i in "${!FILES[@]}"; do
  if [ "$i" -gt 0 ]; then
    JSON+=","
  fi
  # Escape path for JSON
  ESCAPED=$(printf '%s' "${FILES[$i]}" | sed 's/\\/\\\\/g; s/"/\\"/g')
  JSON+="\"$ESCAPED\""
done
JSON+="]"

echo "$JSON"
exit 0
