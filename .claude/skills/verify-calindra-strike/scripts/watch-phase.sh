#!/usr/bin/env bash
# Poll /status and print every change of (phase, map, mode) with a timestamp until a timeout.
# Usage: watch-phase.sh [seconds=40]
set -uo pipefail
SERVER_PORT=${VERIFY_SERVER_PORT:-7450}
END=$((SECONDS + ${1:-40}))
last=""
while [ "$SECONDS" -lt "$END" ]; do
  cur=$(curl -fs "http://127.0.0.1:$SERVER_PORT/status" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(`phase=${j.phase} map=${j.map} mode=${j.mode} players=${j.players}`)}catch{console.log("unreachable")}})')
  if [ "$cur" != "$last" ]; then echo "$(date +%T) $cur"; last=$cur; fi
  sleep 0.5
done
