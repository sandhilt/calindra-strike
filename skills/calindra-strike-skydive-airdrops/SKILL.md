---
name: calindra-strike-skydive-airdrops
description: How spawning, the skydive, and supply air drops work in Calindra Strike. Use when an agent just spawned and is falling, wants a legendary weapon (Mjölnir AWP, Ragnarök LMG), full armour, or is deciding whether an air drop is worth the risk.
---

# Skydive and air drops

## Spawn and skydive

You do not spawn on the ground. Every (re)spawn starts a skydive from the map's drop height inside its drop area.

- While falling you cannot be hit and you cannot fight (`dropping` is true). Other players, bots included, ignore you until you land.
- You glide with the movement keys and dive faster with crouch. Rough speeds are 560 units per second falling, up to 980 diving, and about 520 sideways.
- Landing gives 1.5 seconds of spawn protection. Use it to get your bearings and pick a first goal.
- The bots' routine is a good default. Glide toward the nearest enemy (or the middle of the map when there is none), and start diving once you are within about 200 units of that spot. Landing far from everyone costs time. Landing on top of them costs the fight.

Because the pilot cannot see the map from the sky, treat the first seconds after `you.alive` flips true as set up time and do not read a short `get_state` as a stuck agent.

On Shopping Sul Rio there is also a fixed supply stand on each top floor (the Mirante): see `supplies` in `get_state`. It restores health, armour and ammunition for whoever needs it and refills 40 s after it is taken; it is not a weapon drop.

## Air drops

During a live match, supply crates parachute in on a timer at fixed points per map, up to a small cap at once.

- A crate falls at 140 units per second and cannot be claimed in the air except by standing on top of it. Once it lands, walk within 44 units of it.
- Claiming it gives a legendary weapon, **full armour and full health**. About two crates in three hold the Mjölnir AWP. The rest hold the Ragnarök LMG.
- Crates appear in `get_state` under `airdrops` with distance and bearing. Check them whenever you are not in a fight.

### Worth it?

| Situation | Decision |
| --- | --- |
| Hurt or low armour, no enemy in view | Go for it. The refill alone justifies the trip |
| Enemy near the crate | Wait for the fight to resolve. Bots go to crates 60 percent of the time, so expect company |
| Healthy and one-on-one | Take it if it is close, then use the new weapon's range advantage |

A crate is also bait. Bots within 1600 units will path to it, so ambushing a landed crate works as well as taking it. See `calindra-strike-vs-bots`.

## After pickup

You hold a weapon with a different range and fire mode. Re-read `calindra-strike-combat`. The AWP wants scoped single shots beyond about 350 units. The LMG sprays, so fire it in bursts and strafe between them.
