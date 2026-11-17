# MCP agent actions: jump, crouch, zoom

Date: 2026-11-17. Status: approved by user (small change).

## Intent
The game already lets human players jump, crouch and scope the AWP. MCP agents can only issue move_to / attack / hunt / stop, so they cannot use these movements. Give agents explicit control of them.

## Goals
- `jump`: one-shot jump, ignored unless on the ground.
- `crouch {on}`: latched until changed; reset on death/leave; works with an idle intent.
- `zoom {level}`: 0 = off, 1..n = scope level; errors for weapons without a scope; manual zoom wins over the bot's auto-scope.
- `get_state` reports ducked, zoom and weapon.
- Skills (navigation, combat) and README document the new tools.

## Non-goals / anti-goals
- No change to `shared/` simulation or the protocol (no PROTOCOL_VERSION bump).
- No change to how human players or server bots behave.

## Approaches
1. Override the Cmd buttons in the session/pilot after `brain.think` (chosen): smallest, no protocol or sim change, keeps the bot brain intact.
2. Teach BotBrain a new directive per action: more invasive, couples server bots to agent-only features.
3. New protocol messages: unnecessary, the server already accepts BTN bits.

## Decisions (user delegated to recommendations)
- Crouch and zoom are latched state, jump is a pulse.
- Zoom drives ATTACK2 edges until state.zoom matches the requested level, and suppresses the brain's auto-scope while a manual level is set.
- Tests in tools/test; docs in skills/ and README.
