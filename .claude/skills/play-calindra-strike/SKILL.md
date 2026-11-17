---
name: play-calindra-strike
description: Use when asked to join or play a Calindra Strike match through its MCP game tools (join, hunt, wait, say) and report the experience. Not for implementing or testing game code.
---

# Play Calindra Strike

Coordinates: -z is norte, +x is leste. Game time keeps running while you think, so keep the `wait` loop tight (gaps of 20–30 s cost a large part of a round).

## Setup

- Play in a background subagent when the harness has them, so the main thread stays free; play directly otherwise. One MCP connection is one player: if the main thread already joined, `leave` first, and a second `join` on one connection returns the same character. Claude subagents share the session's single connection, so more Claude players need one `node tools/mcp/launch.ts` each behind a TCP broker (see Connection).
- A match needs `WARMUP_MIN_PLAYERS` players (default 2); a lone player never leaves `warmup`, so make sure someone else is on the server (another player, `BOT_FILL`, dev bots).
- Read this file first and follow it over any summary in the brief. Do not end your turn after `join`: keep the `wait` loop going until the podium, then `leave`.
- Names: at most 16 characters (`Claude-Haiku5.5-B` was rejected, `Claude-Haiku5.5B` works), distinct per player, agent plus model (`Claude-Haiku5.5`, `Codex-GPT6`). A taken name gets `#2`, `#3`; read `you.name` and `you.id` from state, and never hard-code the id (it changes on every `join`).
- Codex players can only call allowlisted tools (`get_state`, `join`, `hunt`, `say`, `wait`, `reload`, `choose_loadout`, `leave`); the rest fail with `MCP tool call requires approval, but approval policy is never`. They play with `hunt` only, which already pursues flags in CTF and plants and defuses in debug defusion (`use` is not on that allowlist). Do not retry a refused tool or bypass it with `--write`.
- To stop a player: `TaskStop` the agent, then `leave` on its connection (a stopped agent leaves its player in the match).

## Core loop

- `join`, then read `phase`, `mode`, `team`, `you.intent`, `score`.
- Set `hunt` to roam and fight. It survives respawns but a new live round resets it to `idle`: check `you.intent` at every phase change and reissue it.
- `wait` takes `{ ms: 100..5000 }` (5000 is practical). Each read drains `events` and `chat`, so count kills from `score`, not by summing events, and read `chat` on every read.
- Finish with `leave` after the podium (`phase: closed`). After `leave`, `get_state` answers `Left game` (plain text, not JSON). Do not vote unless asked.
- Merge what you learn into this file (a tool behaviour, a map pattern, a tactic that worked or failed) and keep the existing sections.

## Counting matches

- Wait for `phase: live` before joining. A join during `podium` shows the previous match's results.
- A match counts only if you joined `live` with about 60 s or more left, stayed to the podium and saw it. For a sample that says something, join with 180 s or more left or at round start: CTF ends at 3 captures (often within a minute), debug defusion at 5 points (`DEFUSE_SCORE_LIMIT`) and TDM at the score limit (often 110–140 s early), and players who joined with 73–78 s left got an empty sample.
- A podium lasts about 15 s. A wait batch or a slow command can jump over it into the next round, so capture the full `results` right when `phase` is `podium` (before another wait) and count each match once, keyed by its results; reset the key when `phase` returns to `live`. `endsInMs` during a podium is the podium's own timer.
- A connection that stays through a podium is put in the next round without a new `join`, possibly on another team (seen 1→0 and 0→1, also mid-TDM from rebalancing) or another map. Re-read `map`, `mode`, `team`, `enemy`, and read the final team from the podium.
- `Socket closed`, `restart` or `Versão desatualizada` mean the round was interrupted and does not count; `join` again (see Connection for stale clients).
- Podium `results` per player: `id, name, kills, deaths, hs, best, team, bot` (plus `vote`, `next`); `winner` is the team index, `-1` for FFA and TDM ties. In FFA everyone is `enemy: true` with `team: -1`. Read final numbers from `results`, not from events.
- Several players from one host share `map`, `mode`, `winner` and `results` at podium and can run concurrently. When two agents play together, verify both IDs are in the same match.

## Targeting

- Decide by `enemy` and `team`, never by name (agents have similar names). `enemy` and `team` can change between rounds and during TDM rebalancing, so read `enemy` on every state.
- `attack` takes only `{ "target_id": <int> }` (`id`, `target`, `name`, `{}` fail with "Unexpected or missing argument"). It needs the target in `others` when sent and ends when perception is lost ("Target not currently perceived", `ended: true`); then use `lastSeen` with `move_to`, or `hunt`.
- After you die, `you.intent` keeps the old `moveTo`/`attack` until the respawn; reissue `hunt` once alive. Intent kinds: `hunt`, `attack`, `moveTo`, `stop`, `idle`.
- Do not chase enemies beyond ~1000 units and do not fight below ~50 HP; wait for the enemy to come closer.

## Weapons and airdrops

- `choose_loadout` (rifle, SMG, shotgun) applies on the next spawn. Right after `join` it worked in one round and not in another, so read `you.slots` after the next spawn. Loadout makes no clear difference (pooled over four Haiku 5.5 high players: SMG 49 headshot kills of 62, rifle 65 of 86). Under `hunt` the shotgun (`Trovão 12`) lost mid-range exchanges in `Escritório` and `Forja` (13/26, 3/15, 3/21): prefer rifle or SMG, shotgun only up close.
- `switch_weapon` takes only `{ "slot": "primary" | "pistol" | "hammer" | "last" }`; `weapon` fails. `weapon` in state updates on the next `wait`. The pilot may undo a switch on the next tick. With magazine and reserve empty, `hunt` falls back to pistol or hammer. `reload` returns only action flags; confirm by `mag` in the next state (`you.mag`, `you.reserve`, `you.slots`). Reload before the magazine empties.
- Airdrops give special weapons (Mjölnir AWP, Ragnarök LMG) and armor, and last until your next death. Read `airdrops` in state (`{ x, z, distance, bearingDeg }`, no id) and do not trust fixed coordinates: drop spots differ between sessions and maps. Seen on Escritório: around `-800, 250`, `-800, -300`, `0, 300`, `800, 300`.
- `hunt` only picks up drops it passes by. To collect one, `move_to` its `x, z` (`arrived: true` can be ~50 units short, and a nearby point can be "unreachable"). Drops often vanish while you approach or are taken by an enemy first, and going for one usually means dying on the way, so go only when no enemy is near. Verify with `you.slots` and `airdrops` instead of assuming pickup. Prioritize survival after collecting one.
- Mjölnir: the CS table applies, not the spread formula. Standing still and scoped is accurate, crouched is perfect, running is very inaccurate; do not run and shoot. `zoom` replaces automatic scoping until respawn.
- Melee finisher: with an enemy close and low ammo, `switch_weapon { "slot": "hammer" }` (Martelo do Eitri, reach 72 units) instead of dry-firing.

## Movement

- `jump` works only when `onGround` and alive; otherwise "No living player snapshot yet" (also if you die between the state read and the call, so retry after a fresh snapshot).
- `crouch({ on })` stays on until you stand. Whether it survives respawn was seen both ways, so read `ducked` after every spawn. Crouch when engaging at close range, stand when roaming.
- Spawns are a parachute drop (y near 960–1000). Running `hunt` during the fall got one agent killed five times in 40 s: wait for `onGround`, crouch if an enemy is near, then reissue `hunt`. Most deaths come right after a respawn.
- Do not stay still in the open. Keep `hunt` or `move_to` active and hold a spot only briefly (scoping, waiting for an incoming enemy).
- Frozen pilot: `attack` can leave the player standing, `stop` leaves `idle`, and some players sit still even with `intent: hunt`. If `you.pos` is unchanged on two reads a few seconds apart while alive and `live`, send `jump` and reissue `hunt`. `move_to` can answer "Target unreachable on navigation grid"; pick another point or go back to `hunt`.

## Aiming and recoil

Why: every shot adds recoil, and shots fired together climb and drift. `hunt` fires bursts of 3–9 shots with pauses too short to recover, and it empties magazines at long range (30 to 0 at over 600 units while standing). Moving, jumping and not crouching add spread; about 1 s without firing resets the recoil. This comes from reading `shared/src/weapons.ts`, `shared/src/sim.ts` and `server/src/bot.ts`; nobody has measured it in play yet.

This is here so you know the recoil exists and can play with it, not to tell you how to shoot. How you handle it is your call: pick the approach you like, mix them, or try something else and see what happens. It only asks that you stay aware of it, since firing on autopilot (`hunt` spraying a whole fight while you never look at `you.mag` or whether the shots land) is what usually goes wrong.

Things you can play with:

- Bursts and pauses: about a second without firing resets the recoil, so you can break a fight into bursts with a `stop` and a short `wait`, or keep firing and accept the drift.
- Distance: from far away (over about 600 units) most shots miss and drain the magazine. You can let the enemy come, close in with `move_to`, or shoot anyway.
- Stance: crouching tightens the spread and shrinks you, but slows you down. Moving, jumping and strafing widen the spread but are harder to hit. Crouch, move, or switch as the fight asks.
- Ammo: `reload` when you choose to, in a lull or mid-fight, knowing a dry magazine costs time.
- Weapon: SMG has the lowest recoil, rifle is balanced, shotgun is strongest up close.

## Chat

- `say` is at most 100 characters (`Invalid text` otherwise; the tool call exits non-zero), in Portuguese, playful, aimed at the match and never at a real person's private details. Provocative chat is welcome (the user enjoys distinct personas).
- Persona: one per player, never shared with another player in the session (cocky veteran, friendly rookie, sarcastic commentator, calm strategist, hot-headed trash-talker), consistent in tone, nickname or running joke for the whole match. When setting up several players, assign them yourself; a player without one picks one not in use by reading the chat. A hot-headed persona may roast aim and gameplay, never with slurs, identity or body insults, threats or private details. When unsure, tone it down.
- Kill punchlines: on a kill, `say` a short joke in your persona's voice that fits it (headshot, hammer finisher, a landmark such as `Bigorna` or `Copa`, a flag carrier stopped, a comeback). Write a new line each time and never repeat your own lines in a match; one agent that reused two lines was flagged. Seeds by persona: veteran `Anos de estrada, garoto.`, rookie `Opa, acertei sem querer!`, commentator `E lá se vai mais um pro lobby.`, strategist `Tudo conforme o plano.`, hot-headed `Essa mira tá de molho, hein?`. Not every kill needs one, but kills are the main moment. After a hammer kill or death, react in persona (victory lap, or a good-humored complaint or rematch challenge).
- Answer the match chat, not only provocations: reply briefly to anything addressed to you or about the match (a "me ajuda" call, a challenge), and never just log chat without answering. Skip hostile or personal messages.
- Callouts, separate from punchlines and never replacing them: where you saw an enemy, hold or head, with landmark names (`scene.landmarks`, for example `Armazém (NE)`) rather than coordinates (`inimigo no corredor leste`, `seguro o centro`). Read teammates' callouts and act on them. Keep teasing the enemy team in persona; coordinating does not replace taunting.
- Strategy: at the start of every round (teams can change after a podium) post one short plan naming who carries, who escorts, who defends and the route or landmark (`Plano: eu pego a bandeira, vcs cobrem o Centro`), in your persona's voice, then act on it. Answer others' plans (`fechado`, `melhor flanquear pela Bigorna`), adopt the clearest one, announce changes (`troca de plano, defendo a base`) and credit good calls. Adapt during the round: after a flag is taken, dropped or captured say who goes next; when the team keeps losing the same fight, change route, send an escort or swap a defender, justified by `get_state` (`flags`, `score.teams`, `endsInMs`). Players limited to `hunt` can still announce a role and ask teammates to cover the route. Keep strategy messages short and spaced so callouts stay readable. Merge strategies that worked or failed into this file at session end.

## Scenery in get_state

- `scene` (null while dead or dropping): `facing` is the crosshair surface (null for sky), `cover` lists nearby visible walls, boxes, windows and platforms (needs line of sight), `doors` includes openings and stairs, `landmarks` gives named places (map knowledge, no line of sight), `sprays` shows decals and authors. Lists are capped and nearest-first. No MCP tool places a spray (`G`, 10 per spawn, 2 s apart, is browser-only).

## Connection and protocol

- For another player, start a separate `node tools/mcp/launch.ts` and drive it over stdio JSON-RPC (`initialize`, `notifications/initialized`, then `tools/call`). When the native MCP tools are not connected, run one `node tools/mcp/launch.ts --url=ws://127.0.0.1:7350/ws --origin=http://localhost:5173` per player behind a small broker you write outside the repo (spawn it, do the handshake once, accept `{tool, args}` lines on a localhost TCP port, return the tool text). Use TCP ports, not Unix sockets (scratch paths exceed the 108-character limit). The same broker serves Claude and Codex subagents.
- `Versão desatualizada: recarregue a página` on every tool means the MCP client is older than the server: compare `protocol` in `curl -s http://127.0.0.1:7350/status` with `PROTOCOL_VERSION` in `shared/src/constants.ts`, then reload the plugin or use a fresh `launch.ts`. When the server restarts on a new `PROTOCOL_VERSION`, every earlier `launch.ts` is stale (`restart`, `Socket closed`, `ECONNREFUSED`, then `Versão desatualizada` on `join`): kill and restart them. `leave` does not refresh a stale client. A stale connection may also lack `jump`, `crouch`, `zoom`, `walk`, `reload`, `switch_weapon`; check `tools/list`. A server that is not listening (port 7350 refused) fails `launch.ts` the same way.
- Through MCP use `jump`, `crouch` and `zoom` instead of keys; the keymap is in `README.md`.
- Slow harness commands: each command can cost 20–35 s of startup (e.g. subagent `run_command` outside the sandbox), long enough to skip the 15 s podium and leave the player `idle` in the next round. Do podium and transition polling inside the Node broker client, not in bash loops (a `for ... $(...)` loop disables command-prefix matching and hits a 60 s permission timeout): add a `watch_podium` subcommand that loops `wait({ ms: 2000 })` until `phase === "podium"`, prints `PODIUM_JSON:<json>`, keeps polling until `live`, then calls `hunt({})` (and `watch_podium_only` for the last round before `leave`). Start it when `endsInMs <= 65000`, TDM score `>= 40`, CTF captures `== 2` or debug defusion points `== 4`. Do not call `leave` while a backgrounded `watch_podium_only` is still running, since it closes the session before the podium is captured.
- Do not chain state-sensitive calls with `&&` (`reload`, `crouch`, `jump` exit non-zero with `No living player snapshot yet` or `Weapon cannot reload`, and over-long `say` exits non-zero): use `;` or handle it in the Node helper.

## Capture the Flag

- Read `flags` in `get_state`: `team`, `state` (`at_base`, `carried`, `dropped`), `carrierId`/`carrierName`, `pos`, `distance`, `bearingDeg`. Capture totals are in `score.teams`; flag events are `k: flag` with `what: take | drop | return | capture`.
- `hunt` follows objectives while fighting. Within a team, players sorted by id take one defender per four members, the rest attack. Attackers seek the enemy flag and keep advancing while an enemy is over 600 units away, then duel; a carrier keeps running home even with an enemy in sight (after first returning a dropped own flag or hunting an enemy carrier); defenders fight, guard home or chase the carrier of their stolen flag. All roles return a dropped own flag by touching it.
- Capture by bringing the enemy flag to your base while your own flag is home. Use `move_to` for explicit coordination and reissue `hunt` afterward. Callouts: `Levo a bandeira, cubram a volta`, `Nossa bandeira caiu em x,z`, `Portador inimigo em x,z`.

## Debug defusion

Read from the code (`shared/src/defuse.ts`, `server/src/bot.ts`, `tools/mcp/view.ts`) when the mode shipped; nobody has played it through the MCP yet, so merge what you see in play here.

- Mode `defuse`. One team attacks, the other defends, and sides swap after every point, so re-read `bomb.role` after each `defused` or `exploded` event. The bug is a laptop: attackers take it at their base, plant it at the site (the other team's base) and it explodes 35 s later (point for the attackers); defenders defuse it (point for the defenders). First to 5 wins.
- Read `bomb` in `get_state`: `state` (`home`, `carried`, `planting`, `dropped`, `planted`), `role` (`attacker`, `defender`), `attackersTeam`, `carrierId`/`carrierName`, `defuserId`/`defuserName`, `pos` with `distance`/`bearingDeg`, `site` (`pos`, `distance`, `bearingDeg`), `secondsToExplosion`, `plantProgress`, `defuseProgress` (0..1). Events are `k: bomb` with `what: take | drop | return | plant | defuse | defused | exploded`.
- Rules: planting is holding USE (`E`) for 3 s inside the site (about 160 units from its centre); defusing is holding USE for 7 s within about 64 units of the planted bug. Letting go, dying or walking out resets the progress, only one player defuses at a time, and a defuse that would end after the fuse loses. Defenders cannot pick the bug up; a dropped bug returns to the attackers' base after 20 s. The objective also runs during `warmup` as practice that scores nothing, and pressing E where it cannot work shows the reason in the HUD (browser players only).
- `hunt` plays the objective: attackers fetch the bug, the carrier walks to the site and holds USE standing still, the rest escort the carrier; defenders hold the site and, once it is planted, walk to the bug and hold USE. Attackers keep advancing while the nearest enemy is over 600 units away, then duel.
- `use` (`{ ms?: 1..10000 }`) holds USE while standing still and answers `planted`, `defused` or `interrupted` with a reason. Call it when you are already on the site or the bug and `hunt` would rather fight, then reissue `hunt`. Standing still makes you an easy target, so clear the area or ask for cover first.
- Defending: do not stack everyone on the bug; one defuses, the rest watch the doors. Attacking: once planted, guard the bug from cover instead of standing on it.
- Callouts: `Levo o bug pro site`, `Bug plantado, cubram a entrada`, `Desarmando, me cubram!`, `Bug caiu em x,z`, `Faltam 10 s pra explodir`.
