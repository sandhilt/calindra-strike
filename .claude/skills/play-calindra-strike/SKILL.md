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

## Field notes (2026-11-17)

- Played three full matches with distinct connections: `Codex GPT-6` (ID 42), `Codex-GPT6-A` (ID 46) and `Codex-GPT6-B` (ID 47). The root state listed both extra IDs separately, confirming that they were real additional players.

| Match | Podium results |
| --- | --- |
| Escritório FFA | Codex GPT-6: 40/36, 29 HS; B: 39/34, 30 HS; A: 33/29, 23 HS. |
| Forja FFA | A: 23/15, 18 HS, best streak 7; B: 14/12, 7 HS, best streak 6; Codex GPT-6: 14/16, 11 HS. |
| Forja TDM | Team score 34–34 (tie). A, team 0: 20/14, 18 HS; Codex GPT-6, team 1: 11/10, 8 HS; B, team 1: 10/8, 9 HS. |

- `hunt` survived deaths but reset to `idle` at the next live match; check `you.intent` and reissue it after every phase transition. A new spawn also reset crouch. `jump` worked when alive and grounded, and returned “No living player snapshot yet” after death or when there was no living snapshot.
- Keep crouch for close fights and restore it after respawning; use jump on the ground. Crouch is visibly retained in `actions.crouch`/`ducked` while active.
- B reported collecting both special primaries in Forja FFA: Mjölnir (100 armor and scope up to level 2) and later Ragnarök (97 magazine + 100 reserve, no scope). It can be worth checking drops while hunting; the root player did not pick one up this session.
- Manual drop navigation was inconclusive: `move_to` accepted a drop coordinate and later reported `arrived: true` about 50 units away, while the drop remained listed and the root loadout stayed unchanged. Another nearby coordinate was rejected as unreachable. Verify `you.slots` and `airdrops` after approaching instead of assuming pickup.
- Read and answer chat from teammates as well as taunts. Short replies to “me ajuda,” a focus/corridor call, and playful challenges kept the conversation match-related. Use an occasional quip, not one after each kill.

## Additional field notes (2026-11-17)

- A second three-match session used `Codex-GPT6-C` (ID 57) and `Codex-GPT6-D` (ID 56) on separate connections. Both appeared as distinct players in the root state and left their own connections after the third podium.

| Match | Podium results |
| --- | --- |
| Escritório FFA | Codex GPT-6: 43/37, 30 HS; D: 35/35, 24 HS; C: 28/27, 19 HS. |
| Forja TDM | Team score 35–35 (tie). D: 22/8, 18 HS, best streak 8; Codex GPT-6: 14/11, 11 HS; C: 9/11, 8 HS. |
| Escritório TDM | Team 1 won 50–41. Codex GPT-6, team 1: 31/22, 25 HS; D, team 0: 20/16, 16 HS; C, team 0: 12/20, 9 HS. |

- A fresh live round again reset the root player's intent to `idle`; reissue `hunt` at every transition. Crouch and jump can fail with “No living player snapshot yet” if the player dies between the state read and action call, so retry after a fresh live snapshot.
- Root picked up Mjölnir in Escritório TDM, confirmed by `you.slots.primary`, and lost it on death. Special weapons last only until death; prioritize survival after collecting one.
- Airdrops can disappear while navigating toward them. Check the live `airdrops` list and `you.slots` after each approach; do not assume reaching a coordinate means the weapon was collected.
- Keep responding to match-directed chat with short playful replies. Teammate calls such as “bora meu amigo, mata ele” are worth answering; keep the tone about the round.

## Guest-agent notes (2026-11-17)

- `Astra Low` (ID 63) played two podiums on its own MCP session: Forja TDM (3/1, 2 HS; winning team), then Escritório FFA (2nd place, 30/26, 21 HS, best streak 5). It left only its own connection after the second podium.
- `Luna High` (ID 65) joined Forja TDM with about 6.8 seconds left, then played Escritório FFA (30/30, 26 HS, best streak 3) and left after the next podium. Joining a round at its final seconds is not a full match of play; count the following complete round for a two-match task.
- An additional agent session can join directly through its own `mcp__calindra_strike__join` tool connection; a local `tools/mcp/launch.ts` attempt to `ws://127.0.0.1:7350` failed because no server was listening there. The direct MCP join produced distinct IDs 63 and 65.

## Astra Low and Luna High (2026-11-17)

- Astra Low (ID 71) and Luna High (ID 72) played two shared matches on separate MCP connections and closed only their own sessions after the second podium.

| Match | Results |
| --- | --- |
| Forja FFA | Astra: 11/3, 9 HS, best streak 8; Luna: 3/5, 3 HS. Both agents confirmed the podium; Luna reported an FFA tie. |
| Escritório TDM | Team 1 won 50–38. Astra, team 1: 23/13, 16 HS, best streak 6; Luna, team 0: 11/21, 10 HS, best streak 2. |

- Both connections joined while a live round still had substantial time remaining (about 117 s for the first FFA and about 289 s for the TDM), stayed through the podiums, then left. For concurrent-agent tasks, verify both IDs are in the same match and count only podiums after meaningful play.
- Both used `crouch` at close range and reactivated it after respawns; crouching tightens aim spread. Keep `hunt` active between fights and reissue it after phase transitions.

## Astra Low and Luna High, second session (2026-11-17)

- Astra Low (ID 78) and Luna High (ID 79) completed two more shared matches on separate connections and closed them after the second podium.

| Match | Results |
| --- | --- |
| Forja TDM | Team 0 won 18–9. Astra: 4/1, 4 HS, best streak 4; Luna: 2/9, 2 HS, best streak 2. Astra collected Mjölnir. |
| Escritório TDM | Team 0 won 41–14. Astra, team 0: 12/7, 9 HS, best streak 6; Luna, team 1: 14/32, 10 HS, best streak 3. |

- Both arrived with more than two minutes remaining in the first round and nearly five minutes in the second, then stayed through both podiums. They confirmed the same match IDs, teams, and final results from their separate sessions.
- Crouch was used in close fights, jump on the ground, and chat replies stayed playful and about the match. Astra's first-round Mjölnir pickup was confirmed in its primary slot.
