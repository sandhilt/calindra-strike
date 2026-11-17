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

Anything above 40 units up, or farther than 300 down, is not an edge. The sky clip above y 600 is ignored.

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

## Numbers worth remembering

| Fact | Value |
| --- | --- |
| Standing and crouched height | 72 and 36 units |
| Top speed | 250 units per second |
| Crouched, walking | 34 percent and 52 percent of top speed |
| Hammer in hand | 280 units per second |
| Bunny hop speed cap | 1.2 times top speed |
