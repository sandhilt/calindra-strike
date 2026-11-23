---
name: calindra-strike-navigation
description: How movement and pathing work in Calindra Strike (nav grid, steps, jumps, drops, getting unstuck). Use when move_to fails or is slow, when picking destinations on Forja or Escritório, or when an agent stands still or loops against a wall.
---

# Calindra Strike navigation

The pilot routes with `NavGrid` from `server/src/nav.ts`, the same grid the server bots walk. Knowing its rules tells you which `move_to` targets will work.

## What the grid is

- One node per standable surface in every 48 unit column of the map. That includes floors, crate tops, desks and roofs, so one `x, z` can have several heights.
- Nodes connect to their 8 neighbours when the hull fits and a clear line exists between them.
- Edge types.

| Edge | Height change | Cost |
| --- | --- | --- |
| Walk | up to 18 units (stairs, kerbs) | distance |
| Jump | up to 40 units (a plain jump reaches 45) | 1.8 times distance plus 30 |
| Drop | down up to 300 units (roofs, perches) | 1.3 times distance |
| Lift | between the floors of a glass lift (Shopping Sul Rio) | ride time at walking speed |

Anything above 40 units up, or farther than 300 down, is not an edge (except a lift ride). The sky clip above y 600 is ignored.

## Floors and lifts (Shopping Sul Rio)

- Three floors: térreo (y 0), praça de alimentação (y 192) and Mirante (y 384). `get_state` `you.floor` names yours and `lifts[].floors` lists the heights. `move_to` takes an optional `y`: give the floor height to go to another floor, and the pilot takes escalators or the glass lift by itself. Without `y` the goal is on the floor you stand on.
- A glass lift is a field, not a vehicle: stand inside its shaft and you rise at a constant speed (crawling at each floor, holding at the top), hold `crouch` to go down. Step out through the doorway while the cab is level with the floor; the ground floor doorway faces the atrium, the others open across the atrium edge. Jumping does nothing inside. If you ride by hand, use `crouch` and `move_to` a point just outside the doorway of the floor you want.
- The pilot and the server bots use the same grid: lift edges join the shaft cells of each floor, and nothing else leads into or out of a shaft between floors.

## Choosing destinations

- `move_to` is checked before it starts. The point must be within 72 units of a standable node, must not sit inside solid geometry, and must be connected to you by a path. Otherwise the call fails with an error that says which. Give a point on a surface a player can stand on.
- A goal with no connected path returns no route. Pick another point. Do not retry the same one.
- Re-issue `move_to` only when the goal changes. The intent persists between your calls and the pilot keeps following it. Server bots re-plan every 1.5 seconds and after every fight.
- Higher ground is reachable by jump edges and then usable as cover. Dropping off a roof is allowed and fast but loses height you may not get back.

## How the pilot walks

- A waypoint counts as reached within 26 units horizontally and 40 vertically.
- It only walks forward once it faces the waypoint within about 70 degrees, so sharp turns cost a moment.
- It jumps when it is within 72 units of a jump edge and standing on the ground.

## Getting unstuck

Every 0.75 seconds the pilot checks whether you moved less than 10 units. While you `hunt`, three failed checks in a row make it jump, pick a random reachable goal and re-plan. With `move_to` or `attack` it only jumps and keeps your original goal. If `get_state` shows the same position for several waits, send a different `move_to` instead of waiting.

## Jump and crouch yourself

- `jump` is a single jump and fails in the air. Use it to clear a ledge or a low crate when `get_state` shows the same position after a wait. It does not replace `move_to`.
- `crouch {on: true}` stays set, even while idle, until `crouch {on: false}` or until you respawn. You move at 34 percent of top speed while it is on, so turn it off before a long `move_to`.
- `walk {on: true}` is the `Shift` key. It stays set, also while idle, until `walk {on: false}` or until you respawn. Walking is silent for human players but you move at 52 percent of running speed, so turn it off before a long `move_to`. Bot hearing does not depend on it.
- All of them need a living player. `get_state` shows `you.onGround`, `you.ducked` and `you.actions` (`crouch`, `zoom`, `walk`).

## Numbers worth remembering

| Fact | Value |
| --- | --- |
| Standing and crouched height | 72 and 36 units |
| Top speed | 250 units per second |
| Crouched, walking | 34 percent and 52 percent of top speed |
| Hammer in hand | 280 units per second |
| Bunny hop speed cap | 1.2 times top speed |
