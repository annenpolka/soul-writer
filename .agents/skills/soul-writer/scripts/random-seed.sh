#!/usr/bin/env bash
# random-seed.sh — カタログからランダム選択しJSON出力
# Usage: bash random-seed.sh <soul-dir> [--seed N]
# Output: JSON to stdout
# Dependencies: jq, python3 (for YAML parsing)

set -uo pipefail

SOUL_DIR="${1:?Usage: random-seed.sh <soul-dir> [--seed N]}"
SEED=""

shift
while [ $# -gt 0 ]; do
  case "$1" in
    --seed) SEED="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -n "$SEED" ]; then
  RANDOM=$SEED
fi

CATALOG_FILE="$SOUL_DIR/diversity-catalog.json"
CONFIG_FILE="$SOUL_DIR/prompt-config.yaml"

if [ ! -f "$CATALOG_FILE" ]; then
  echo '{"error": "diversity-catalog.json not found"}' >&2
  exit 2
fi

# --- Helper: pick random element from JSON array ---
pick_random_jq() {
  local json_array="$1"
  local count
  count=$(echo "$json_array" | jq 'length')
  if [ "$count" -eq 0 ]; then
    echo "null"
    return
  fi
  local idx=$((RANDOM % count))
  echo "$json_array" | jq ".[$idx]"
}

# --- Read diversity-catalog.json ---
EMOTIONS=$(jq '.emotion_catalog' "$CATALOG_FILE")
CONCEPTS=$(jq '.concept_seeds' "$CATALOG_FILE")
NARRATIVES=$(jq '.narrative_catalog' "$CATALOG_FILE")
OPENINGS=$(jq '.opening_constraints' "$CATALOG_FILE")

# --- Read prompt-config.yaml (via python3) ---
if [ -f "$CONFIG_FILE" ]; then
  YAML_JSON=$(python3 -c "
import sys, json
try:
    import yaml
    with open('$CONFIG_FILE', 'r') as f:
        data = yaml.safe_load(f)
    json.dump(data, sys.stdout, ensure_ascii=False)
except ImportError:
    # Fallback: no PyYAML available
    json.dump({}, sys.stdout)
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    json.dump({}, sys.stdout)
" 2>/dev/null)

  TIMELINES=$(echo "$YAML_JSON" | jq '[.timeline_catalog[]? | .label // .]' 2>/dev/null || echo '[]')
  STRATEGIES=$(echo "$YAML_JSON" | jq '[.ideation_strategies[]? | .text // .]' 2>/dev/null || echo '[]')
  TONES=$(echo "$YAML_JSON" | jq '.tone_catalog // []' 2>/dev/null || echo '[]')
else
  TIMELINES='[]'
  STRATEGIES='[]'
  TONES='[]'
fi

# --- Random selections ---
EMOTION=$(pick_random_jq "$EMOTIONS")
CONCEPT=$(pick_random_jq "$CONCEPTS")
NARRATIVE=$(pick_random_jq "$NARRATIVES")
OPENING=$(pick_random_jq "$OPENINGS")

# Timeline
TIMELINE_COUNT=$(echo "$TIMELINES" | jq 'length')
if [ "$TIMELINE_COUNT" -gt 0 ]; then
  TIMELINE_IDX=$((RANDOM % TIMELINE_COUNT))
  TIMELINE=$(echo "$TIMELINES" | jq ".[$TIMELINE_IDX]")
else
  TIMELINE='"出会い前（孤立期）"'
fi

# Strategy
STRATEGY_COUNT=$(echo "$STRATEGIES" | jq 'length')
if [ "$STRATEGY_COUNT" -gt 0 ]; then
  STRATEGY_IDX=$((RANDOM % STRATEGY_COUNT))
  STRATEGY=$(echo "$STRATEGIES" | jq ".[$STRATEGY_IDX]")
else
  STRATEGY='"対位法"'
fi

# Tone (object with label + directive)
TONE_COUNT=$(echo "$TONES" | jq 'length')
if [ "$TONE_COUNT" -gt 0 ]; then
  TONE_IDX=$((RANDOM % TONE_COUNT))
  TONE=$(echo "$TONES" | jq ".[$TONE_IDX]")
else
  TONE='{"label": "冷徹分析", "directive": "冷徹で乾いた観察眼。感情を名指しせず、事実と身体反応だけで描く。文は短く、断定的。"}'
fi

# --- Output JSON ---
jq -n \
  --argjson emotion "$EMOTION" \
  --argjson timeline "$TIMELINE" \
  --argjson strategy "$STRATEGY" \
  --argjson concept "$CONCEPT" \
  --argjson tone "$TONE" \
  --argjson narrative "$NARRATIVE" \
  --argjson opening "$OPENING" \
  '{
    emotion: $emotion,
    timeline: $timeline,
    strategy: $strategy,
    concept: $concept,
    tone: $tone,
    narrative: $narrative,
    opening: $opening
  }'
