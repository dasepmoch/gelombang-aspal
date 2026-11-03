#!/usr/bin/env bash
# Local stand-in for the CI shard matrix: N parallel render processes, one per shard.
#   ./scripts/shard-render.sh            # all 20 shards, capped by SHARD_PARALLEL
#   ./scripts/shard-render.sh 0 3        # shards 0..3 only (for a smoke test)
set -euo pipefail
cd "$(dirname "$0")/.."

TOTAL_FRAMES=1440
SHARDS=20
PARALLEL="${SHARD_PARALLEL:-4}"
FIRST="${1:-0}"
LAST="${2:-19}"
PER=$(( (TOTAL_FRAMES + SHARDS - 1) / SHARDS ))

mkdir -p out/frames out/logs
seq "$FIRST" "$LAST" | xargs -P "$PARALLEL" -I{} bash -c '
  START=$(( {} * '"$PER"' ))
  END=$(( START + '"$PER"' - 1 ))
  if [ "$END" -ge '"$TOTAL_FRAMES"' ]; then END=$(( '"$TOTAL_FRAMES"' - 1 )); fi
  echo "shard {} -> $START..$END"
  node render/render.mjs --start $START --end $END --out out/frames > out/logs/shard-{}.log 2>&1
'
echo "frames on disk: $(ls out/frames | wc -l)"
