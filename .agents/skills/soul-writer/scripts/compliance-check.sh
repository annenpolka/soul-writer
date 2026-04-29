#!/usr/bin/env bash
# compliance-check.sh — ソウルテキスト適合度チェック（10ルール）
# Usage: bash compliance-check.sh <text-file> <soul-dir> [--prev-chapter <path>]
# Output: JSON to stdout
# Exit: 0 = compliant, 1 = violations found
# macOS/Linux互換（grep -P不使用）

set -uo pipefail

TEXT_FILE="${1:?Usage: compliance-check.sh <text-file> <soul-dir> [--prev-chapter <path>]}"
SOUL_DIR="${2:?Usage: compliance-check.sh <text-file> <soul-dir> [--prev-chapter <path>]}"
PREV_CHAPTER=""

shift 2
while [ $# -gt 0 ]; do
  case "$1" in
    --prev-chapter) PREV_CHAPTER="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ ! -f "$TEXT_FILE" ]; then
  echo '{"error": "Text file not found: '"$TEXT_FILE"'"}' >&2
  exit 2
fi

TEXT=$(cat "$TEXT_FILE")
VIOLATIONS="[]"
ERROR_COUNT=0
WARNING_COUNT=0

add_violation() {
  local rule="$1" severity="$2" detail="$3"
  VIOLATIONS=$(echo "$VIOLATIONS" | jq --arg r "$rule" --arg s "$severity" --arg d "$detail" \
    '. + [{"rule": $r, "severity": $s, "detail": $d}]')
  if [ "$severity" = "error" ]; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
  else
    WARNING_COUNT=$((WARNING_COUNT + 1))
  fi
}

# --- Rule 1: forbidden-words ---
if [ -f "$SOUL_DIR/constitution.json" ]; then
  FORBIDDEN_WORDS=$(jq -r '.universal.vocabulary.forbidden_words[]? // empty' "$SOUL_DIR/constitution.json" 2>/dev/null || true)
  while IFS= read -r word; do
    [ -z "$word" ] && continue
    count=$(grep -o "$word" "$TEXT_FILE" 2>/dev/null | wc -l | xargs)
    if [ "$count" -gt 0 ] 2>/dev/null; then
      add_violation "forbidden-words" "error" "${word} (${count}件)"
    fi
  done <<< "$FORBIDDEN_WORDS"
fi

# --- Rule 2: forbidden-similes ---
if [ -f "$SOUL_DIR/constitution.json" ]; then
  FORBIDDEN_SIMILES=$(jq -r '.universal.rhetoric.forbidden_similes[]? // empty' "$SOUL_DIR/constitution.json" 2>/dev/null || true)
  while IFS= read -r simile; do
    [ -z "$simile" ] && continue
    count=$(grep -o "$simile" "$TEXT_FILE" 2>/dev/null | wc -l | xargs)
    if [ "$count" -gt 0 ] 2>/dev/null; then
      add_violation "forbidden-similes" "error" "${simile} (${count}件)"
    fi
  done <<< "$FORBIDDEN_SIMILES"
fi

# --- Rule 3: special-marks ---
if grep -q '×' "$TEXT_FILE" 2>/dev/null; then
  ALLOWED_FORMS=$(jq -r '(.universal.vocabulary.special_marks.forms[]? // empty), (.universal.vocabulary.special_marks.allowed_forms[]? // empty)' "$SOUL_DIR/constitution.json" 2>/dev/null || true)
  if [ -n "$ALLOWED_FORMS" ]; then
    while IFS= read -r line_num_and_content; do
      [ -z "$line_num_and_content" ] && continue
      line_num=$(echo "$line_num_and_content" | cut -d: -f1)
      line_content=$(sed -n "${line_num}p" "$TEXT_FILE" 2>/dev/null || true)
      if [ -n "$line_content" ]; then
        is_allowed=false
        while IFS= read -r form; do
          [ -z "$form" ] && continue
          if echo "$line_content" | grep -qF "$form"; then
            is_allowed=true
            break
          fi
        done <<< "$ALLOWED_FORMS"
        if [ "$is_allowed" = false ]; then
          context=$(echo "$line_content" | cut -c1-60)
          add_violation "special-marks" "error" "line ${line_num}: ${context}"
        fi
      fi
    done < <(grep -n '×' "$TEXT_FILE" 2>/dev/null || true)
  fi
fi

# --- Rule 4: pov-consistency ---
temp_narration=$(mktemp)
sed 's/「[^」]*」//g' "$TEXT_FILE" > "$temp_narration"

# 「私」の検出（複合語除外）
if grep -q '私' "$temp_narration" 2>/dev/null; then
  watashi_found=$(awk '
  {
    idx = index($0, "私")
    while (idx > 0) {
      next_char = substr($0, idx+1, 1)
      compound = "立物服生的達用見情刑有設"
      if (index(compound, next_char) == 0) {
        print "found"
        exit 0
      }
      rest = substr($0, idx+1)
      idx2 = index(rest, "私")
      if (idx2 > 0) { idx = idx + idx2 } else { idx = 0 }
    }
  }' "$temp_narration")
  if [ "$watashi_found" = "found" ]; then
    add_violation "pov-consistency" "error" "「私」を検出（「わたし」を使用すること）"
  fi
fi

for pronoun in "僕" "俺"; do
  if grep -q "$pronoun" "$temp_narration" 2>/dev/null; then
    add_violation "pov-consistency" "error" "「${pronoun}」を検出（一人称は「わたし」固定）"
  fi
done
rm -f "$temp_narration"

# --- Rule 5: rhythm-check ---
# 。！？で文を分割し、長さをチェック（awkで処理）
rhythm_result=$(awk '
BEGIN { total=0; short_count=0; long_violations="" }
{
  n = split($0, sentences, /[。！？]/)
  for (i=1; i<=n; i++) {
    s = sentences[i]
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", s)
    if (length(s) == 0) continue
    total++
    len = length(s)
    if (len > 100) {
      excerpt = substr(s, 1, 60)
      long_violations = long_violations len "文字:" excerpt "...\n"
    }
    if (len <= 20) short_count++
  }
}
END {
  printf "%d\t%d\t%s", total, short_count, long_violations
}' "$TEXT_FILE")

total_sentences=$(echo "$rhythm_result" | cut -f1)
short_sentences=$(echo "$rhythm_result" | cut -f2)
long_info=$(echo "$rhythm_result" | cut -f3-)

if [ -n "$long_info" ]; then
  echo "$long_info" | while IFS= read -r line; do
    [ -z "$line" ] && continue
    add_violation "rhythm-check" "warning" "$line"
  done
fi

if [ "$total_sentences" -ge 5 ] && [ "$total_sentences" -gt 0 ]; then
  ratio=$((short_sentences * 100 / total_sentences))
  if [ "$ratio" -lt 30 ]; then
    add_violation "rhythm-check" "warning" "短文比率: ${ratio}%（30%以上推奨）"
  fi
fi

# --- Rule 6: markdown-contamination ---
# ERE (Extended Regular Expression) で検出
md_bold=$(grep -o '\*\*' "$TEXT_FILE" 2>/dev/null | wc -l | xargs)
md_code=$(grep -o '`' "$TEXT_FILE" 2>/dev/null | wc -l | xargs)
md_heading=$(grep -cE '^#{1,6} ' "$TEXT_FILE" 2>/dev/null | xargs || echo 0)
md_codeblock=$(grep -c '^```' "$TEXT_FILE" 2>/dev/null | xargs || echo 0)

if [ "${md_bold:-0}" -gt 0 ]; then
  add_violation "markdown-contamination" "error" "**太字**記法検出 (${md_bold}件)"
fi
if [ "${md_code:-0}" -gt 0 ]; then
  add_violation "markdown-contamination" "error" "\`コード\`記法検出 (${md_code}件)"
fi
if [ "${md_heading:-0}" -gt 0 ]; then
  add_violation "markdown-contamination" "error" "#見出し記法検出 (${md_heading}件)"
fi
if [ "${md_codeblock:-0}" -gt 0 ]; then
  add_violation "markdown-contamination" "error" "\`\`\`コードブロック記法検出 (${md_codeblock}件)"
fi

# --- Rule 7: chinese-contamination ---
chinese_chars="这那里着过还没什怎为时候"
chinese_count=0
for i in $(seq 0 $((${#chinese_chars} - 1))); do
  char="${chinese_chars:$i:1}"
  c=$(grep -o "$char" "$TEXT_FILE" 2>/dev/null | wc -l | xargs)
  c=${c:-0}
  chinese_count=$((chinese_count + c))
done
if [ "$chinese_count" -gt 0 ]; then
  add_violation "chinese-contamination" "error" "簡体字パターン検出 (${chinese_count}件)"
fi

# --- Rule 8: quote-originality ---
if [ -d "$SOUL_DIR/fragments" ]; then
  for frag_file in "$SOUL_DIR/fragments/"*.json; do
    [ -f "$frag_file" ] || continue
    jq -r '.[].text // empty' "$frag_file" 2>/dev/null | while IFS= read -r frag_text; do
      [ -z "$frag_text" ] && continue
      search=$(echo "$frag_text" | cut -c1-30)
      if [ ${#search} -ge 20 ] && grep -qF "$search" "$TEXT_FILE" 2>/dev/null; then
        add_violation "quote-originality" "error" "断片の直接コピーの可能性: ${search}..."
      fi
    done
  done
fi

# --- Rule 9: self-repetition ---
# 6文字以上の同一フレーズが3回以上出現する場合を検出
self_rep_result=$(awk '
BEGIN { }
{
  # 文を句点で分割
  n = split($0, sentences, /[。！？]/)
  for (i = 1; i <= n; i++) {
    s = sentences[i]
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", s)
    len = length(s)
    if (len < 6) continue
    # 6-20文字のサブストリングを抽出してカウント
    for (start = 1; start <= len - 5; start++) {
      for (sub_len = 6; sub_len <= 20 && start + sub_len - 1 <= len; sub_len++) {
        substr_text = substr(s, start, sub_len)
        phrase_count[substr_text]++
      }
    }
  }
}
END {
  found = 0
  for (phrase in phrase_count) {
    if (phrase_count[phrase] >= 3 && length(phrase) >= 6) {
      # 他のより長いフレーズの部分文字列でないか簡易チェック
      is_substring = 0
      for (other in phrase_count) {
        if (other != phrase && phrase_count[other] >= 3 && length(other) > length(phrase) && index(other, phrase) > 0) {
          is_substring = 1
          break
        }
      }
      if (!is_substring) {
        printf "%s\t%d\n", phrase, phrase_count[phrase]
        found++
        if (found >= 5) exit 0
      }
    }
  }
}' "$TEXT_FILE" 2>/dev/null || true)

if [ -n "$self_rep_result" ]; then
  echo "$self_rep_result" | while IFS=$'\t' read -r phrase count; do
    [ -z "$phrase" ] && continue
    excerpt=$(echo "$phrase" | cut -c1-30)
    add_violation "self-repetition" "warning" "「${excerpt}」が${count}回出現"
  done
fi

# --- Rule 10: chapter-variation ---
# 前章との冒頭・末尾の類似度チェック
if [ -n "$PREV_CHAPTER" ] && [ -f "$PREV_CHAPTER" ]; then
  # 現在の章の冒頭100文字と末尾100文字
  current_opening=$(head -c 300 "$TEXT_FILE" | cut -c1-100)
  current_ending=$(tail -c 300 "$TEXT_FILE" | rev | cut -c1-100 | rev)

  # 前章の冒頭100文字と末尾100文字
  prev_opening=$(head -c 300 "$PREV_CHAPTER" | cut -c1-100)
  prev_ending=$(tail -c 300 "$PREV_CHAPTER" | rev | cut -c1-100 | rev)

  # 冒頭の類似チェック: 20文字以上の共通部分文字列を検出
  if [ -n "$current_opening" ] && [ -n "$prev_opening" ]; then
    # 現在の冒頭から20文字のウィンドウを切り出して前章と照合
    opening_len=${#current_opening}
    for start_pos in $(seq 0 $((opening_len - 20))); do
      window=$(echo "$current_opening" | cut -c$((start_pos + 1))-$((start_pos + 20)))
      if [ ${#window} -ge 20 ] && echo "$prev_opening" | grep -qF "$window" 2>/dev/null; then
        add_violation "chapter-variation" "warning" "冒頭が前章と類似: 「${window}」"
        break
      fi
    done
  fi

  # 末尾の類似チェック
  if [ -n "$current_ending" ] && [ -n "$prev_ending" ]; then
    ending_len=${#current_ending}
    for start_pos in $(seq 0 $((ending_len - 20))); do
      window=$(echo "$current_ending" | cut -c$((start_pos + 1))-$((start_pos + 20)))
      if [ ${#window} -ge 20 ] && echo "$prev_ending" | grep -qF "$window" 2>/dev/null; then
        add_violation "chapter-variation" "warning" "末尾が前章と類似: 「${window}」"
        break
      fi
    done
  fi
fi

# --- Output ---
IS_COMPLIANT="true"
if [ "$ERROR_COUNT" -gt 0 ]; then
  IS_COMPLIANT="false"
fi

GROUPED=$(echo "$VIOLATIONS" | jq '
  group_by(.rule) | map({
    rule: .[0].rule,
    severity: .[0].severity,
    count: length,
    details: [.[].detail]
  })
')

jq -n \
  --argjson compliant "$IS_COMPLIANT" \
  --argjson violations "$GROUPED" \
  --argjson errorCount "$ERROR_COUNT" \
  --argjson warningCount "$WARNING_COUNT" \
  '{
    isCompliant: $compliant,
    violations: $violations,
    errorCount: $errorCount,
    warningCount: $warningCount
  }'

if [ "$IS_COMPLIANT" = "false" ]; then
  exit 1
else
  exit 0
fi
