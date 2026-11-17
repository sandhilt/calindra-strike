---
name: play-calindra-strike
description: Play Calindra Strike through its MCP game tools and report the experience. Use when asked to join or play a match, not for implementing or testing game code.
---

# Play Calindra Strike

## Core loop

- Join with the requested name (or a recognizable one for the agent), then read `phase`, `mode`, `team`, `you.intent` and `score`.
- Set `hunt` to roam and fight. It persists across respawns, but a new match can reset it to `idle`. Check at every phase change and reissue `hunt` when needed.
- Use `wait` (100–5000 ms, 5000 is practical) to advance time and read state. Each read drains `events` and `chat`, so count kills from `score`, not by summing events.
- Wait for `phase: live` before joining. A join during `podium` shows the previous match's results; count a match only after its `podium` and then `leave` (`phase: closed`).
- Finish a match by sending `leave` after `podium`. Do not vote unless asked.

## Targeting

- Check `enemy` and `via` before attacking. Decide by `enemy` and `team`, never by name: other agents have similar names.
- `attack` needs the target in `others` at the moment you send it; it ends when perception is lost. After that, use `lastSeen` with `move_to` to search, or `hunt` again.
- Do not chase a distant enemy (over ~1000 units). Wait for it to come closer.
- A player at low HP who keeps fighting usually dies on the next exchange. Below ~50 HP, wait for the enemy to approach.

## Weapons and airdrops

- Airdrops give special weapons (Mjölnir, Ragnarök) and armor. They appear at recurring coordinates (Escritório: around `-800, 250`, `-800, -300`, `0, 300`, `800, 300`; Forja: around `960, -320`, `-960, 320`). Read `airdrops` in state.
- To collect one, `move_to` its coordinates. `hunt` only collects drops it passes by. A special weapon lasts until your next death.
- Reload or move before going for a drop with a low magazine. When a special weapon runs dry, `switch_weapon` (`primary`, `pistol`, `hammer`, `last`) returns to a loaded weapon; read `you.slots` first.
- `choose_loadout` (rifle, SMG, shotgun) only applies on the next spawn.

## Movement

- `jump` works only when `onGround` and `alive`. It fails with "No living player snapshot yet" while dead.
- `crouch({ on: true|false })` stays on until you stand, including after respawn. Read `ducked` from state before standing again; the pilot can re-crouch on its own.
- Crouch when engaging at close range; stand when roaming.

## Chat

- `say` (up to 100 characters) works during a live match. One short, playful Portuguese message per match is enough, and never after every kill.

## Connection and protocol

- One MCP connection is one player. A second `join` on the same connection returns the same character. For another player, start a separate `node tools/mcp/launch.ts` process and drive it over stdio JSON-RPC (`initialize`, `notifications/initialized`, then `tools/call`).
- If every game tool answers `Versão desatualizada: recarregue a página`, the harness's MCP client is older than the server. Compare `protocol` in `curl -s http://127.0.0.1:7350/status` with `PROTOCOL_VERSION` in `shared/src/constants.ts`. Fix it by reloading the plugin, or by using a fresh `launch.ts` process.
- A stale connection may lack newer tools (`jump`, `crouch`, `zoom`, `walk`, `reload`, `switch_weapon`). Check `tools/list` before relying on them.
- Give each player a distinct name of at most 16 characters: the model plus a suffix, such as `Claude-H5.5-A`. If a name is taken, the server appends `#2`, `#3`, so read `you.name` and `you.id` from state.

## Several players and podium counting

- Several players from one host are fine. They can run concurrently and share the same `map`, `mode`, `winner` and `results` at podium.
- A repeated `wait` can return the same podium state. Count each match once, keyed by its results, and reset the key when `phase` returns to `live`.
- FFA and TDM ties report `winner: -1`. In FFA everyone is `enemy: true` and `team: -1`.
