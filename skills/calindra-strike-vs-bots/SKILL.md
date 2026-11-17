---
name: calindra-strike-vs-bots
description: How the Calindra Strike server bots perceive, aim and choose goals, and how to beat them. Use when playing against BOT_FILL bots, tuning BOT_SKILL, or explaining why an agent keeps losing or winning duels against bots.
---

# Beating the server bots

Numbers below come from `server/src/bot.ts`. Bots play at 60 Hz through the same simulation and rules as you, so they are beatable by cutting off what they rely on.

## What a bot knows

| Sense | Rule |
| --- | --- |
| Scan rate | Looks for a target every 6 ticks (100 ms) |
| Sight | Up to 2600 units, inside a 140 degree cone in front |
| Hearing | Notices anyone within 420 units, even behind it |
| Line of sight | Needs an unblocked ray from its eye to your chest (44 units up) or head (64 units up) |
| Skydiving players | Ignored until they land |

You are invisible to a bot that is looking away or behind cover beyond 420 units. Approaching from behind at a distance, or shooting from outside its cone, gets you the first shots.

## How a bot fights

- **Reaction.** On acquiring a target it waits before firing. At default skill this is roughly 275 to 410 ms, down to 150 to 280 ms at the top. Landing first shots in that window decides most duels.
- **Aim error.** It starts a few degrees off (about 6 at low skill, 2 at high) and the error decays over roughly 0.2 to 0.45 seconds. Longer duels favour the bot, so shoot first and shoot fast.
- **Turn rate.** 260 degrees per second at low skill to 620 at high. You can out-flank it.
- **Headshots.** It aims for the head 15 to 50 percent of the time.
- **Fire pattern.** Bursts of 3 to 8, then a 230 to 480 ms pause. It strafes between bursts. The pause is your window to peek and shoot.
- **AWP bots** scope in beyond 350 units. Do not stand in the open at range against one. Close the distance or break line of sight.
- **Close up** a bot with the hammer rushes inside 80 units.

## Where bots go

Every 3 to 6 seconds a bot chooses a goal.

| Situation | Goal |
| --- | --- |
| A landed air drop within 1600 units | The drop, 60 percent of the time |
| Otherwise, or after that | The nearest enemy, even if it cannot see them |
| Remaining share | A random spot on the map |

So bots do not wander blindly. They converge on the nearest player, and they contest air drops. Holding a corridor with one approach, or standing beside an air drop, makes bots come to you in a line.

## Skill scaling

`BOT_SKILL` is 0 to 100 (the README default is 50, `.env.example` ships 45). Each bot gets the skill plus or minus up to 0.15, so a table is never uniform. Test your agent at `BOT_SKILL=20`, `50` and `80` to see whether it improved or just got lucky.

## Do and do not

- Do shoot first, from outside the cone, then break line of sight and re-engage.
- Do use cover and crouch. A blocked ray is something a bot cannot see through.
- Do not fight in the open at range against an AWP bot.
- Do not stand still after a kill. Another bot is likely already walking to you.
