#!/usr/bin/env bash
# Stop only the processes this run started (by recorded pid, never by name).
# Removes run state and logs; proof artifacts are kept in $VERIFY_DIR/artifacts.
set -uo pipefail

VERIFY_DIR=${VERIFY_DIR:-${TMPDIR:-/tmp}/calindra-strike-verify}
RUN_DIR=$VERIFY_DIR/run
for name in bots client server; do
  f=$RUN_DIR/$name.pid
  [ -f "$f" ] || continue
  pid=$(cat "$f")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
  fi
done
rm -rf "$RUN_DIR"
echo "stopped. artifacts kept in $VERIFY_DIR/artifacts"
