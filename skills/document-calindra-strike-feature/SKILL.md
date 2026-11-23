---
name: document-calindra-strike-feature
description: Document a new Calindra Strike feature in the project docs before considering it done. Use when adding a gameplay feature, control, mode, menu, setting, MCP tool or bot behaviour, or when a change is about to be committed without docs.
---

# Document every new feature

A feature that exists only in the code is not finished. Write the docs in the same change as the code, and do it before you call the work ready or commit it. Docs are in English (game UI text stays in Portuguese). Keep the same short style as the surrounding file, and label numbers that are guesses as tuning values.

There is no per-feature manual under `docs/`. That folder only holds Superpowers design notes (`docs/superpowers/specs/`, `docs/superpowers/plans/`). Shipped behaviour is documented in `README.md`, `AGENTS.md`, `.env.example` and the skills below. Do not add a new file under `docs/` for a finished feature, and do not start a separate notes file.

## What to include

Say, as far as they apply:

- **What it is.** What the player, operator or agent can do now, in one or two sentences, next to the closest existing feature.
- **How to use it.** Controls, keys, menu entries, when it is available (lobby, match, podium, spectator).
- **Configuration.** New or changed env vars: name, default, range or units, and what `0` / empty means.
- **Impact.** What changes on the server, for MCP agents (`get_state`, new or changed tools, perception) and for bots (`BOT_FILL`, goals, radio, nav), if anything.

## Where to write it

Update every place that applies. Skip the rest.

| Audience | Where |
| --- | --- |
| Players (gameplay, controls, modes, graphics, sounds, menus) | `README.md`: the feature list at the top, the Controls section, or a short subsection next to the closest one (as Graphics, Impact sounds, Weapon side and Watching a match already do) |
| Operators (env settings) | The Server settings table in `README.md`, a commented entry in `.env.example`, an explicit entry in `compose.yaml` (it does not pass the whole environment through) and a case in `server/test/config.test.ts`. Follow "Config comes from env" in `AGENTS.md` |
| Agents (MCP tools, `get_state` fields, how agents perceive the game) | `README.md` under "Play with an AI agent (MCP)", the tool's own `description` in `tools/mcp/` (that is what agents read) and `.claude/skills/play-calindra-strike/SKILL.md`. Then bump the MCP pin (`bump-calindra-strike-mcp`) |
| Developers (hidden modes, scripts, tables others extend, rules a later change could break) | `AGENTS.md`, next to the closest section |
| Verify recipes (user-facing behaviour an agent should prove in the sandbox) | A feature file under `.claude/skills/verify-calindra-strike/features/`, linked from that folder's `README.md` |
| How to play or host | The matching skill in `skills/` (`play-calindra-strike`, `host-calindra-strike`, combat, navigation, vs-bots, skydive-airdrops) when the change alters those instructions |

Special cases already have a home: radio lines in "Radio lines (Calindra menu)" in `README.md`, sound packs in "Sound packs", maps in the Maps convention in `AGENTS.md`, surfaces and impact sounds in that same file, and graphics cost in "Keep the performance tier light".

## When it is done

Do not commit or call the feature ready until the docs in this change match the behaviour. If you cannot document it yet, the feature is not finished.
