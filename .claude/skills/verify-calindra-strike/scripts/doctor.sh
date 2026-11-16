#!/usr/bin/env bash
# Read-only check: is this verification instance the one we started, and is it usable?
set -uo pipefail

VERIFY_DIR=${VERIFY_DIR:-${TMPDIR:-/tmp}/calindra-strike-verify}
RUN_DIR=$VERIFY_DIR/run
SERVER_PORT=${VERIFY_SERVER_PORT:-7450}
CLIENT_PORT=${VERIFY_CLIENT_PORT:-5273}
fail=0
check() { if "$@"; then echo "ok   $DESC"; else echo "FAIL $DESC"; fail=1; fi; }

alive() { [ -f "$RUN_DIR/$1.pid" ] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null; }
DESC="server process started by this run is alive" check alive server
DESC="client process started by this run is alive" check alive client

status=$(curl -fs "http://127.0.0.1:$SERVER_PORT/status" 2>/dev/null || true)
DESC="/status answers with a protocol number" check test -n "$(printf '%s' "$status" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);if(typeof j.protocol==="number")console.log(j.protocol)}catch{}})')"
DESC="client serves the Calindra Strike page" check sh -c "curl -fs http://127.0.0.1:$CLIENT_PORT/ | grep -q '<title>Calindra Strike</title>'"
DESC="client was built against our server (ws port $SERVER_PORT)" check sh -c "curl -fs http://127.0.0.1:$CLIENT_PORT/src/config.ts | grep -q '127.0.0.1:$SERVER_PORT/ws'"
[ -n "$status" ] && echo "status: $status"
exit $fail
