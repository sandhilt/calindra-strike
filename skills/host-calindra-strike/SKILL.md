---
name: host-calindra-strike
description: Start, configure and check a Calindra Strike game server so an AI agent (or people) can join it. Use when the calindra-strike MCP cannot join, when asked to run the game for agents, to add bots as opponents, to put an access code on it, or to expose it beyond localhost.
---

# Host Calindra Strike for agents

The MCP is just a game client. It needs a reachable server whose `ALLOWED_ORIGINS` contains the origin the MCP sends, and the access code if `JOIN_CODE` is set.

## Local, same machine

```bash
npm install
WARMUP_MIN_PLAYERS=1 BOT_FILL=4 node --run dev:server   # ws://127.0.0.1:7350/ws
curl -s http://127.0.0.1:7350/status
```

The MCP defaults to `ws://127.0.0.1:7350/ws` with origin `http://localhost:5173`, which the server allows out of the box. `WARMUP_MIN_PLAYERS=1` lets a solo agent start a match and `BOT_FILL` adds server bots as opponents while someone is online.

Check `/status` first. It shows `players`, `phase`, `protocol` and `codeRequired`. If the MCP says the version is outdated, the server and the checkout disagree on `PROTOCOL_VERSION` (compare with `protocol` in `/status`).

## Pointing the MCP somewhere else

The plugin passes these environment variables to the MCP process. Set them before starting the harness.

| Variable | Default | Meaning |
| --- | --- | --- |
| `CALINDRA_STRIKE_URL` | `ws://127.0.0.1:7350/ws` | Server WebSocket URL |
| `CALINDRA_STRIKE_ORIGIN` | `http://localhost:5173` | Origin header the MCP sends |
| `CALINDRA_STRIKE_CODE` | empty | Access code when the server has `JOIN_CODE` |

Without the plugin, pass the same values as `--url`, `--origin` and `--code` to `node tools/mcp/launch.ts`.

## Reaching the server from another machine

1. The server listens on loopback by default. Set `HOST` to expose it, or put a reverse proxy or tunnel in front. Use TLS (`wss://`) for anything public.
2. Add the origin the MCP sends to `ALLOWED_ORIGINS` (exact origins, no path, comma separated) and restart.
3. Set `JOIN_CODE` before exposing a lobby, because an open lobby accepts anyone.
4. `MAX_PLAYERS` and `MAX_PER_IP` apply to agents too.

Keep URLs, tunnels and codes out of the repository. Put them in your own `.env` or shell.

## Cleaning up

Stop the server you started and any agents you joined. A joined agent holds a player slot until it calls `leave` or its process ends. To drive an isolated sandbox with fixed ports and clean teardown, use the `verify-calindra-strike` project skill instead of a long-lived server.
