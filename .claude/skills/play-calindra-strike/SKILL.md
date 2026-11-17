---
name: play-calindra-strike
description: Play Calindra Strike through its MCP game tools and report the experience. Use when asked to join or play a match, not for implementing or testing game code.
---

# Play Calindra Strike

Join with the name the user asked for (or a recognizable name for the agent playing), inspect phase, mode, team and perception, then use `hunt` for automatic roaming and combat. Check state after joining and at round transitions: `hunt` may reset to `idle` when the next match starts. `wait` runs the pilot for 100–5000 ms and returns the state while draining events and chat.

- Check `enemy` and `via` before attacking. Teammates can be visible through team information. Bearing is relative to facing, positive to the right. Use `lastSeen` and `move_to` to search for an enemy after losing sight; unreachable navigation goals fail.
- Prioritize visible airdrops when practical. In Forja TDM, one session reported an airdrop gave a Ragnarök and 100 armor. Drops can disappear before arrival: check state en route. In another round, reaching the old marked coordinates found no drop and left the current SMG unchanged.
- The current MCP server exposes `jump`, `crouch`, `zoom`, `walk`, `reload` and `switch_weapon` (commits `cafb6b6`, `d724ceb`, `8184ca5` and `82d4dec`). A connection started before those commits does not list them, so check `tools/list` or restart the plugin before relying on them. `switch_weapon` takes `primary`, `pistol`, `hammer` or `last`, and `get_state` shows what each slot holds in `you.slots`. `choose_loadout` still selects rifle, SMG or shotgun for the next spawn, and airdrop pickup may change the current primary weapon. In the browser, Space jumps, Ctrl or C crouches, Shift walks, R reloads and 1, 2, 3 or Q switch weapon.
- To collect a special weapon, walk to the airdrop coordinates with `move_to`. One run walked about 1600 units in roughly 20 s and got Mjölnir with 100 armor. `hunt` also heads for airdrops, but it may not reach them during a fight. Reload or move before going for a drop with a low magazine.
- Monitor health, armor, magazine and reserve. The pilot reloads automatically and `hunt` continues after respawn. A match transition can reset the intent; reissue `hunt` if the new round shows `idle`.
- `jump` and `crouch` fail with "No living player snapshot yet" while dead; call them only when `you.alive` is true (and `onGround` for `jump`). Crouching fits engagements; it slows roaming, so stand up (`crouch({ on: false })`) when no enemy is visible.
- If `join` fails with "Versão desatualizada: recarregue a página", the MCP plugin process is older than the running server (they disagree on `PROTOCOL_VERSION`; compare with `protocol` in `/status`). Either restart the plugin, or drive a fresh `node tools/mcp/launch.ts` process over line-delimited JSON-RPC (it loads the checkout's protocol) with a small driver that spawns it, sends `initialize`, then `join`/`hunt`/`wait` calls.
- Report scores and match outcomes as observed. For multiple players in one session, use distinct name suffixes such as `-A` and `-B`. FFA players are enemies to each other.
- Renaming by calling `join` with a new name on the same connection drops and reconnects the player: the personal score resets to 0/0 and intent resets to `idle`. Reissue `hunt` after renaming; the team score is untouched.

Escritório TDM, a later session (2 kills by the middle of the match):
- Other agents join as players too, sometimes under similar-looking names. Treat them as enemies or teammates by the `enemy` and `team` fields, not by the name.
- A player at low HP who keeps hunting tends to die on the next exchange. When HP drops below about 50, wait for the enemy to come closer before attacking.
- Airdrops appear at the same coordinates across matches (Escritório had drops near x -800, z 250 and x -800, z -300). Use `airdrops` in the state to decide whether a detour is worth it.
- A match transition can drop you into `idle` with a new `alive: false`. Check the state and reissue `hunt`.

Observed in separate sessions: rifle and SMG both produced kills, but samples are too small to rank them. A Forja TDM ended in a 32–22 team win with one agent at 14 kills, 10 deaths and 12 headshots. A later Forja TDM ended 14–13 for the agent's team, and an Escritório TDM ended 22–24 with the agent at 16 kills and 18 deaths, almost all with the rifle. TDM can also end in a tie when time expires (Forja, 6–6, few players left). Treat those as examples, not expected performance.

One session, full Escritório TDM from 0–0 to podium:
- Pick a recognizable name for the agent playing (add a suffix when one session runs several players), within the 16-character limit. Depending on the MCP plugin version, a repeated `join` either returns the same character unchanged or renames/reconnects it (see the note above). The pilot's own reconnect mid-match can replace a custom name with the connection's name, so check `you.name` after every `leave`/`join` event and reissue `hunt` if the intent resets.
- `hunt` survived a Forja → Escritório match transition in this session, but check the intent at each phase change anyway: other sessions saw it reset to `idle`.
- Batch `wait` calls (for example 10 × 5000 ms per tool call) to follow a whole 5-minute match efficiently; read `endsInMs`, `score`, `events` and `you.intent` in the returned states instead of printing full states.
- `say` works during a live match; one short playful Portuguese message per match is enough (for example "Escritório pegando fogo! Vamos fechar essa virada! 🔥").
- Airdrops recur at familiar coordinates across Escritório matches (`-800, 250`, `-800, -300`, `0, 300`, `800, 300`). `hunt` only collects them when it happens to pass by; a pickup such as Mjölnir lasts until the next death, after which the rifle returns.
- Result of the full match: team 0 lost 22–24 to team 1, with the session's agent as top fragger at 16 kills, 18 deaths and 13 headshots (several end-of-match deaths came from other agents). Treat these as observed numbers, not an expectation.

Another session, two completed TDM matches:
- On 2026-11-17, joined near the start of Escritório TDM and stayed through podium. Team 1 won 24–22; the agent finished 15/12 with 13 headshots. Picked up Mjölnir from an airdrop with 100 armor.
- The next match was Forja TDM. Team 1 won 22–19; the agent finished 2/11 with 2 headshots. Picked up Mjölnir with 100 armor again. Special-weapon pickups and armor are temporary; the weapon returned to the rifle after death.
- The scoreboard name comes from `join({name})`. After leaving at podium and joining with a different `name`, the server creates a new player with that exact name and fresh 0/0 stats. Leave/rejoin only after recording the finished match result when you want to rename without losing that match's recorded totals.
- Hunt stayed active through both matches and handled movement, firing, respawns and airdrop detours. Check phase and intent after transitions; reissue `hunt` if it becomes `idle`.

Another session, two more complete matches (2026-11-17):
- From `join` at 0–0 through podium: Forja TDM ended in a 19–22 team loss, with the agent at 13 kills, 10 deaths and 10 headshots (second on the scoreboard behind a human player). The following match was Forja FFA, where everyone has `enemy: true` and `team: -1`, `score` has only `me` (no `teams`) and the podium `winner` is `-1`; the agent won it with 15 kills, 16 deaths and 13 headshots.
- `jump()` and `crouch({ on: true/false })` work through MCP: `ducked` stays `true` until you stand (also after respawn), while `jump()` works only on the ground. The pilot can also change `ducked`, so read it from state and normalize with `crouch({ on: false })` instead of assuming only your own calls changed it.
- An enemy at `bearingDeg ≈ 0` can stay in sight for many seconds without a kill when behind cover; `via: sight` and bearing alone do not guarantee a shot.
- One short playful Portuguese `say` per match worked well in both modes (for example "FFA na Forja! Ragnarök na mão, vem que tem! ⚡").
- Airdrops in both matches gave Ragnarök and Mjölnir; each special weapon lasted until the next death, then the rifle returned.

Another session, two further complete matches (2026-11-17):
- Joined a Forja TDM already in progress (score 8–9) and played to podium (12/11, 10 headshots, team loss 29–33), then played two matches from 0–0: Escritório TDM ended 49–50 against with the agent at 22 kills, 21 deaths and 17 headshots (second behind another agent), and Forja TDM ended in a 6–6 tie (`winner: -1`) with 3 kills, 2 deaths and 3 headshots. A TDM tie also reports `winner: -1`, not just FFA.
- The intent was `idle` at the start of both new matches, so `hunt` had to be reissued; confirm it right after the podium → live transition.
- With few players connected, a match can go minutes without a kill and finish tied. A special weapon can also run dry (Mjölnir at mag 1, reserve 0) and MCP has no manual weapon switch: `choose_loadout` only affects the next spawn, so the rifle returns on death or via another airdrop.
- Repeated `crouch({ on: false })` calls did not always stick because the pilot re-crouched on its own; read `ducked` from state before deciding whether to stand again.
- Other agents use all kinds of player names; always use `enemy`/`team` from state, never the name, to decide who to shoot.

MCP connection troubleshooting (2026-11-17):
- If every game tool answers `Versão desatualizada: recarregue a página`, the harness's MCP client was started with an older `PROTOCOL_VERSION` than the server. Compare `curl -s http://127.0.0.1:7350/status` (`protocol`) with `PROTOCOL_VERSION` in `shared/src/constants.ts`; the harness plugin cannot be fixed by calling `join` again.
- Workaround without reloading the plugin: start a fresh MCP process from the checkout with `node tools/mcp/launch.ts` and drive it over stdio JSON-RPC (`initialize`, then `tools/call` with `name` and `arguments`). A fresh process picks up the current protocol and also exposes newer tools such as `walk`, `reload` and `switch_weapon`, which a stale harness connection may lack.
- `switch_weapon({ slot: 'primary' })` is useful when an airdrop weapon such as Mjölnir runs dry: MCP has no other in-hand weapon switch, and the pilot cannot make a dry special weapon deal damage.
