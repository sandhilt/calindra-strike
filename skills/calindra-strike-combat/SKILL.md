---
name: calindra-strike-combat
description: Fire discipline and weapon handling for Calindra Strike, taken from how the server bots fight. Use when choosing between attack, hunt and move_to in a fight, picking a weapon or range, deciding when to reload, scope or retreat, or when an agent is losing duels.
---

# Calindra Strike combat

The server bots in `server/src/bot.ts` play by the same rules as you, so their habits are a tested recipe. The pilot behind `attack`, `hunt` and `move_to` is that same brain (`BotBrain`), with its skill set by the MCP's `--skill` option (0 to 1, default 0.7). This skill is for the decisions that stay with you.

## Aim

- Aim point is the chest by default. Standing, the chest is 44 units above the feet and the head 64. Crouching, 20 and 30.
- Headshots multiply damage by 4 for the pistol, rifle, SMG, AWP and LMG, by 2 for each shotgun pellet and by 1.4 for the hammer. The hitbox is small. A shot only lands when your aim is inside `atan(12 / distance)` plus 0.6 degrees of the target for the body, and `atan(7 / distance)` plus 0.6 for the head. At 1000 units the head window is about 1 degree.
- Do not fire while still turning toward the target. Bots wait until the aim error is under that tolerance and only then press fire.
- Switching targets costs a fresh reaction and fresh aim error. Bots even bias toward the current target (a 30 percent distance discount) to avoid flicking between people. Prefer finishing one enemy with `attack` over re-running `hunt` mid-duel.

## Firing

| Weapon type | How to fire |
| --- | --- |
| Automatic (rifle, SMG, LMG) | Bursts of 3 to 8 rounds, then release for about a quarter of a second so recoil resets. Do not hold the trigger down. |
| Semi-automatic (pistol, AWP) | One press per shot. Holding does nothing. |
| Shotgun | Close range only. Pellet damage falls off fast past about 3000 units. |
| Hammer | Run straight at the target and swing inside about 80 units. Holding it runs at 280 units per second, 12 percent faster than a pistol. |

## Movement while fighting

- Stand still to shoot and strafe between bursts. Spread grows when you run. The bots counter-strafe for 20 to 50 ticks (a third to nearly a second) in a random direction, then reverse.
- Bots walk toward a target that is farther than about 1100 units while they strafe. Do the same instead of trading shots at the edge of your weapon's range.
- Crouching shrinks your hitbox and tightens spread. Use `crouch {on: true}` for a held position and `crouch {on: false}` before you move again, because crouched you walk at 34 percent speed. Walking (`Shift`) is silent.

## The AWP (Mjölnir)

- Scope in before the shot when the target is farther than about 350 units. `zoom {level: 1}` or `{level: 2}` scopes (FOV 40 then 10) and `{level: 0}` leaves the scope. Close up, scoping only costs you time. It errors when the weapon in hand has no scope.
- Once you call `zoom` the pilot stops scoping on its own until you respawn. Call it again for each target distance. Scoped, you move at 150 units per second instead of 210 unscoped, so stand still before the shot.
- 115 damage kills with one body shot. The scope drops while you work the bolt and returns on its own.
- Unscoped shots are inaccurate. Do not use it as a rifle at close range, switch to the pistol.

## Ammo discipline

- Reload when no enemy is in view and the magazine is under 40 percent.
- If a weapon is empty with no reserve, fall back at once. Bots go to the pistol, and the pistol falls back to the hammer.
- Pick up an air drop to refill health and armour. See `calindra-strike-skydive-airdrops`.

## When to leave a fight

Retreat with `move_to` when health is low and more than one enemy is near, then `hunt` again once you have broken line of sight. A bot loses you the moment it cannot trace a clear line to your chest or head, so a wall is often a better defence than armour. See `calindra-strike-vs-bots` for exactly how bots see.
