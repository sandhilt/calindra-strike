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
- When you play, merge what you learned into this file instead of writing a new notes file, and keep the existing sections. If you find something new (a tool behaviour, a map pattern, a tactic that worked or failed), add it here so the next agent that plays can use it.

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
- Do not stay still for long in the open: a stationary player is an easy target and risks dying. Keep `hunt` or `move_to` active, change position between fights, and only hold a spot briefly (for example to scope or to wait for an enemy that is coming). Keep the `wait` loop tight too, since game time runs while you are idle between calls.

## Chat

- `say` (up to 100 characters) works during a live match. Provocative chat is welcome (the "stunts" the user asked for): once or twice per match, for example after a notable kill or a comeback, never after every kill. Keep it playful, in Portuguese, aimed at the match and never at a real person's private details.
- Give each bot or agent its own persona for chat (a cocky veteran, a friendly rookie, a sarcastic commentator): a different tone, nickname or running joke, kept consistent across the whole match.
- Personas range from calm to hot-headed. A hot-headed persona may trash-talk and roast the other players' aim or gameplay, but never with slurs, insults about identity or body, threats, or any real person's private details. When unsure, tone it down.
- React to the match chat too, not only to provocations: when a message from another player is addressed to you or is about the match, answer with a short playful `say`. Read `chat` in every `wait` and `get_state` result, since reading drains it. Skip hostile or personal messages.
- Call out locations so other bots and agents can coordinate, especially with the friendly team. Short callouts in Portuguese through `say`: where you saw an enemy, where you are holding, where you are heading (for example `inimigo no corredor leste`, `seguro o centro`). Use the map's landmark names, not raw coordinates. Read teammates' callouts in `chat` and act on them (rotate, back up, push together). Callouts are useful information, so they do not count against the once-or-twice limit above.
- Melee finisher: when an enemy is close enough and your ammo is low, `switch_weapon` with `{ "slot": "hammer" }` (Martelo do Eitri, reach 72 units) and kill the opponent with it instead of dry-firing. Then react with a short playful `say` in persona, whether the kill landed or you died trying: a victory lap after the kill, a good-humored complaint or a rematch challenge after the death. Read `you.slots` first, and note that the pilot may undo the switch on the next tick (see the tool notes below).
- Coordinating with the team does not replace taunting the opponents. Keep roasting and teasing the enemy team in persona, in the same message or a separate one, within the limits above and the 100-character limit.

## Connection and protocol

- One MCP connection is one player. A second `join` on the same connection returns the same character. For another player, start a separate `node tools/mcp/launch.ts` process and drive it over stdio JSON-RPC (`initialize`, `notifications/initialized`, then `tools/call`).
- If every game tool answers `Versão desatualizada: recarregue a página`, the harness's MCP client is older than the server. Compare `protocol` in `curl -s http://127.0.0.1:7350/status` with `PROTOCOL_VERSION` in `shared/src/constants.ts`. Fix it by reloading the plugin, or by using a fresh `launch.ts` process.
- A stale connection may lack newer tools (`jump`, `crouch`, `zoom`, `walk`, `reload`, `switch_weapon`). Check `tools/list` before relying on them.
- Name players for the agent playing them, not `Agente-*`: the agent's name plus its model in the `join` name (for example `Claude-Haiku5.5`, `Codex-GPT6`), at most 16 characters, with `-A` / `-B` suffixes when one session runs several players. Each player needs a distinct name. If a name is taken, the server appends `#2`, `#3`, so read `you.name` and `you.id` from state.
- The browser keymap is in `README.md`. Through MCP, use the `jump`, `crouch` and `zoom` tools instead of keys.

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

## Tool arguments and recoil (2026-11-17)

Three Claude agents (Haiku 5.5, `Claude-S5.5-A/B/C`) played one Forja TDM (team 0 won 20–19). The MCP client was not connected in that session, so they drove three `launch.ts` processes through a small stdin/socket broker. Same tools, same results.

### Exact arguments

- `attack` takes only `{ "target_id": <int> }`. `id`, `target`, `name` and `{}` all fail with "Unexpected or missing argument".
- `switch_weapon` takes only `{ "slot": "primary" | "pistol" | "hammer" | "last" }`. The `weapon` key fails. `weapon` in `get_state` updates on the next `wait`, so a state read right after the switch still shows the old weapon.
- `wait` takes `{ "ms": 100..5000 }`. `reload` only returns the action flags (`crouch`/`walk`/`zoom`); confirm the reload by the `mag` value in the next state.
- With the magazine and reserve empty, `hunt` falls back to the pistol or the hammer on its own. `switch_weapon primary` may be undone by the pilot on the next tick. Reload before the magazine runs dry.
- Game time keeps running while you think. Long gaps between calls (20–30 s) cost a large part of a round; keep the `wait` loop tight.

### Recoil and spread: what you can and cannot control

None of the three agents measured recoil in play; this section is read from `shared/src/weapons.ts`, `shared/src/sim.ts` and `server/src/bot.ts` (the pilot uses the bot brain). Check it against a real spray before relying on it.

- Recoil is a per-shot index (`s.recoil`, +1 per shot). Each shot is fired at `aim + recoilOffset(index)`: a vertical climb `maxPitch * (1 - exp(-index * climb / maxPitch))` that settles, then a slow horizontal wander from `swayStart`. It is deterministic, not random, and the server and the client compute it the same way.
- On top of that, spread grows by `perShot * index` up to `perShotMax`, by running speed, and by being in the air. Crouching on the ground multiplies spread by `duckMult` (0.7–0.9).
- The index only recovers after the weapon has been idle for more than `fireTicks + 1` ticks, at `recovery` per second (R7 8/s, Brokkr 9/s, Ragnarök 7/s, pistol 7/s).

| Weapon | Climb (°/shot) | Max pitch (°) | Sway (°) from shot | Spread per shot (max) | Duck mult |
| --- | --- | --- | --- | --- | --- |
| Forja R7 (rifle) | 0.75 | 7 | 1.6 from 7 | 0.004 (0.035) | 0.75 |
| Brokkr (SMG) | 0.45 | 4 | 1.0 from 5 | 0.002 (0.020) | 0.8 |
| Ragnarök (LMG) | 0.5 | 5 | 2.2 from 8 | 0.001 (0.020) | 0.7 |
| Faísca P9 (pistol) | 1.4 | 6 | 0.6 from 2 | 0.018 (0.060) | 0.8 |
| Trovão 12 (shotgun) | 3 | 6 | none | none (9 pellets, base 0.065) | 0.9 |
| Mjölnir (AWP) | 2 | 2 | none | CS table, not the formula | n/a |

- **The pilot does not subtract recoil from its aim.** `bot.ts` aims at the target and fires bursts of 3 to 9 shots with a 14 to 30 tick pause between them. The pause recovers only about 2 to 4 index units on the R7, so long bursts land progressively higher and to the side. This fits the agents' complaint that `hunt` walks into fights and loses them.
- What the agent can still change: `crouch` before a fight (tighter spread, smaller hitbox); `stop` or `walk` instead of moving while a target is in view, since moving adds up to 0.11 on the R7; do not `jump` mid-fight (airborne adds 0.25 on the R7); `choose_loadout smg` for the lowest climb and spread growth at close range; prefer the shotgun only up close; reload before the magazine empties.
- AWP (Mjölnir): the CS table applies instead of the spread formula. Standing still and scoped is the most accurate; crouched is perfect; running makes it very inaccurate. Do not run and shoot with it. `zoom` replaces the automatic scoping until you respawn.
- B was killed by a headshot while crouched right after a respawn and reported `ducked: true` surviving the respawn. That agrees with the `crouch` note in the Movement section but not with the "A new spawn also reset crouch" line in the first field notes; read `ducked` before assuming either.

### Other observations from this match

- Airdrop pickups: C confirmed Mjölnir via `you.weapon` after `move_to` to (-400, 960) with `arrived`; B got a drop at (-320, -960) (ammo went to 100), A's Ragnarök showed a 100 magazine. The coordinates C and B saw on Forja ((-1000, -1376), (-400, 960), (-320, -960), (-1376, 1000), (1000, 1376)) do not match the Forja list under Weapons and airdrops, so read `airdrops` in state rather than trusting fixed coordinates.
- The podium `results` give kills, deaths, HS, best streak and team per player, plus `vote` and `next`.

## Terra Low and Luna High interruption (2026-11-17)

- Separate agents `Codex-Terra6.1` (ID 9, Terra 6.1 low) and `Codex-Luna` (ID 8, Luna high) confirmed two shared podiums: Escritório FFA (Terra 15/17, 14 HS; Luna 16/15, 11 HS), then Forja TDM (both team 0, loss 12–21; Terra 3/10, 3 HS; Luna 6/10, 4 HS).
- Their third round started as Escritório TDM, Terra team 1 and Luna team 0, but MCP calls began returning `restart`, followed by `Versão desatualizada: recarregue a página` on `join`. No third podium was confirmed. Do not count a round interrupted this way as complete.
- `leave` returned `phase: closed` for Terra, but a subsequent `join` still failed with the version error. Disconnecting alone does not refresh a stale MCP implementation; reload the integration or use a fresh client pointed at the actual game service. Local port 7350 refused connections in this session.

## Capture the Flag

- In `ctf`, read `flags` in `get_state`: each entry has `team`, `state` (`at_base`, `carried`, `dropped`), `carrierId`/`carrierName`, `pos`, `distance` and `bearingDeg`. Team capture totals are in `score.teams`; flag events use `k: flag` and `what: take | drop | return | capture`. Reads drain events.
- `hunt` fights perceived enemies first, then follows CTF objectives. Within each team, players sorted by id alternate attacker (first) and defender (second). Attackers seek the enemy flag; defenders guard home or chase the carrier of their stolen flag. Both roles return a dropped own flag.
- Carry the enemy flag to your own base to capture; your own flag must be home. A carrier first returns a dropped own flag or hunts its enemy carrier, then heads home once the own flag is home. Touch your dropped flag to return it. Use `move_to` for explicit coordination and reissue `hunt` afterward.
- Use team chat callouts such as “Levo a bandeira, cubram a volta”, “Nossa bandeira caiu em x,z” and “Portador inimigo em x,z”. Share current flag coordinates and respond to teammates.
