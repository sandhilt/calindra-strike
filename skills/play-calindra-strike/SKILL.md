---
name: play-calindra-strike
description: Play Calindra Strike (browser FPS, CS 1.6 style) through the calindra-strike MCP tools. Use when asked to play, join a match, fight bots or players, climb the leaderboard, or test the game by actually playing it.
---

# Play Calindra Strike

You are a normal player on an authoritative server. The MCP tools steer a pilot that runs at 30 packets per second between your calls, so you decide **what** to do and the pilot handles the how (pathing, aiming, jumping, reloading). The game is real time and you are slow, so give goals, not keystrokes.

## Before you start

The tools are `join`, `get_state`, `move_to`, `attack`, `hunt`, `stop`, `jump`, `crouch`, `zoom`, `walk`, `reload`, `switch_weapon`, `wait`, `choose_loadout`, `say`, `vote`, `switch_team` and `leave`. A server must be running and reachable. If `join` fails, read its error verbatim and use the `host-calindra-strike` skill. Do not retry a wrong access code in a loop.

## The loop

1. `join` with a short name (16 characters at most) and a primary weapon (`rifle`, `smg` or `shotgun`).
2. `get_state` and read it. Check `phase` first.
3. Pick one intent. `hunt` is the sensible default. It roams toward air drops and random spots until it perceives an enemy, then fights. `attack` locks onto one enemy you can currently perceive, `move_to` goes to a point, `stop` holds still and holds fire.
4. `wait` 500 to 1500 ms. It returns fresh state, so you rarely need `get_state` right after.
5. React to what changed, then go back to step 3. An intent keeps running until you replace it, so do not re-send the same one.
6. `leave` when you are done. A connected player holds a slot on the server.

## Reading the state

- `you` has position, health, armour, weapon and ammo, plus your current `intent`. A `move_to` intent gains `arrived: true` when you get there. An `attack` intent gains `ended: true` when the target dies, becomes a teammate, skydives or leaves your perception, and an `intent` event says which.
- `others` lists only players you can perceive. `via` is `sight` (a clear line to them within 2600 units), `sound` (within 420 units, even behind a wall) or `team` (teammates are always listed). `perception` at the top reads `line-of-sight`, or `omniscient` when the MCP was started with `--omniscient`, which lists everyone.
- `lastSeen` holds enemies you perceived in the last 10 seconds and cannot perceive now, with their last position and `secondsAgo`. Use it with `move_to` to search or ambush.
- In the podium phase the state also carries `vote` (options with an `index`), `results`, `winner` and `next`.
- `events` and `chat` hold what happened since your last read and are cleared by it. They keep at most the last 20 events and 10 chat lines, so read often during busy fights.
- You perceive no enemies while skydiving or dead. Teammates still show.

## Match phases

- **warmup**: waiting for enough players. The server starts the match by itself. Wait in long steps instead of polling.
- **live**: fight.
- **podium**: the match is over. `vote` for the next map and mode using the option numbers in the state. Then go back to waiting.

You respawn about 3 seconds after dying and skydive in. Landing gives about 1.5 seconds of spawn protection. If `you.alive` is false there is nothing to do but wait.

## Modes

- **ffa**: everyone is an enemy.
- **tdm**: Bulldogs against Martelos. No friendly fire. Do not chase teammates, and read `enemy` on each entry of `others` rather than guessing from names. `switch_team` only helps when the other side is smaller.

## Weapons

Headshots multiply damage (4 times for most guns, see `calindra-strike-combat`) and armour absorbs part of body damage. Pick your primary with `choose_loadout` or at `join`.

| Weapon | Damage | Notes |
| --- | --- | --- |
| Forja R7 (`rifle`) | 36 | Accurate at any range. Best default. |
| Brokkr SMG (`smg`) | 26 | High fire rate, loses damage past mid range. |
| Trovão 12 (`shotgun`) | 22 per pellet | Nine pellets. Strong up close, weak past about 3000 units. |
| Faísca P9 | 34 | Pistol, needs a re-press per shot. |
| Mjölnir | 115 | AWP from air drops. One body shot kills. |
| Ragnarök | 33 | LMG from air drops. |
| Martelo do Eitri | 55 | Melee. Run speed bonus. |

Air drops parachute in with legendary weapons and full armour. They appear in `airdrops` with distance and bearing. Grab one when nobody is shooting at you.

## Tactics that matter

- Fight enemies one at a time. Moving while shooting beats standing still against a rifle.
- Low health and many enemies near you means `move_to` away from them or toward an air drop, then `hunt` again.
- `distance` is in game units. Player height is 72. Close range is under 500 units.
- Do not trust old state. Positions change every tick and a state older than a second can be wrong.

## Go deeper

- `calindra-strike-combat` for aim, burst fire, weapon ranges and when to retreat.
- `calindra-strike-navigation` for how `move_to` routes and how to get unstuck.
- `calindra-strike-vs-bots` for how server bots see, react and choose goals.
- `calindra-strike-skydive-airdrops` for spawning, the skydive and supply crates.

## Etiquette

This is an office game. Keep `say` short (100 characters at most, the server rejects more) and friendly, and use it rarely. Leave when asked, and never run more than one agent per player slot you were given.
