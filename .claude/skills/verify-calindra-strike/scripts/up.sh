#!/usr/bin/env bash
# Start an isolated game server + Vite dev client for verification.
# Prints the URLs on success. Run from anywhere, needs `node` (>= 24) on PATH.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
VERIFY_DIR=${VERIFY_DIR:-${TMPDIR:-/tmp}/calindra-strike-verify}
RUN_DIR=$VERIFY_DIR/run
SERVER_PORT=${VERIFY_SERVER_PORT:-7450}
CLIENT_PORT=${VERIFY_CLIENT_PORT:-5273}

if [ -e "$RUN_DIR/server.pid" ] || [ -e "$RUN_DIR/client.pid" ]; then
  echo "A verification run already owns $RUN_DIR. Run scripts/down.sh first." >&2
  exit 1
fi
for p in "$SERVER_PORT" "$CLIENT_PORT"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then
    echo "Port $p is already in use by something this run did not start. Set VERIFY_SERVER_PORT / VERIFY_CLIENT_PORT." >&2
    exit 1
  fi
done

mkdir -p "$RUN_DIR" "$VERIFY_DIR/artifacts"

# Fast, deterministic defaults: a 20 s match and one player is enough to start it. Override via env.
export HOST=127.0.0.1 PORT=$SERVER_PORT
export ALLOWED_ORIGINS="http://127.0.0.1:$CLIENT_PORT,http://localhost:$CLIENT_PORT"
export MATCH_SECONDS=${MATCH_SECONDS:-20} PODIUM_SECONDS=${PODIUM_SECONDS:-3}
export WARMUP_MIN_PLAYERS=${WARMUP_MIN_PLAYERS:-1} BOT_FILL=${BOT_FILL:-0}

# Start the binaries directly (no npm/shell wrapper) so the recorded pid is the real process.
(cd "$ROOT" && exec node server/src/index.ts) >"$RUN_DIR/server.log" 2>&1 &
echo $! >"$RUN_DIR/server.pid"
(cd "$ROOT/client" && VITE_GAME_SERVER="ws://127.0.0.1:$SERVER_PORT/ws" exec ./node_modules/.bin/vite --port "$CLIENT_PORT" --strictPort) >"$RUN_DIR/client.log" 2>&1 &
echo $! >"$RUN_DIR/client.pid"

for _ in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:$SERVER_PORT/health" >/dev/null 2>&1 && curl -fs "http://127.0.0.1:$CLIENT_PORT/" >/dev/null 2>&1; then
    echo "client=http://127.0.0.1:$CLIENT_PORT server=http://127.0.0.1:$SERVER_PORT ws=ws://127.0.0.1:$SERVER_PORT/ws"
    echo "artifacts=$VERIFY_DIR/artifacts logs=$RUN_DIR"
    exit 0
  fi
  sleep 0.5
done
echo "Not ready after 30 s. Server log:" >&2
tail -n 20 "$RUN_DIR/server.log" >&2 || true
echo "Client log:" >&2
tail -n 20 "$RUN_DIR/client.log" >&2 || true
"$(dirname "$0")/down.sh" >/dev/null 2>&1 || true
exit 1
