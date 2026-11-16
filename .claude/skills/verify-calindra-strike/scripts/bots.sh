#!/usr/bin/env bash
# Start dev bots against the verification server and record their pid (stopped by down.sh).
# Usage: bots.sh [count=1] [passive]
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
VERIFY_DIR=${VERIFY_DIR:-${TMPDIR:-/tmp}/calindra-strike-verify}
RUN_DIR=$VERIFY_DIR/run
SERVER_PORT=${VERIFY_SERVER_PORT:-7450}
CLIENT_PORT=${VERIFY_CLIENT_PORT:-5273}
[ -f "$RUN_DIR/server.pid" ] || { echo "Run scripts/up.sh first." >&2; exit 1; }
[ ! -f "$RUN_DIR/bots.pid" ] || { echo "Bots already started by this run." >&2; exit 1; }
(cd "$ROOT" && exec node tools/bots.ts "${1:-1}" "ws://127.0.0.1:$SERVER_PORT/ws" "http://127.0.0.1:$CLIENT_PORT" ${2:+"$2"}) >"$RUN_DIR/bots.log" 2>&1 &
echo $! >"$RUN_DIR/bots.pid"
echo "bots started (pid $(cat "$RUN_DIR/bots.pid"), log $RUN_DIR/bots.log)"
