# Calindra Strike

Browser FPS with Counter-Strike 1.6 style gameplay for the Calindra office. Authoritative Node.js WebSocket server plus a Vite + Three.js client. See `README.md` for gameplay, server settings and hosting.

## Layout

npm workspaces, TypeScript (ESM), Node >= 22.

| Path | Purpose |
| --- | --- |
| `shared/` | Deterministic code used by both sides: movement (`sim.ts`, `physics.ts`), weapons, maps, protocol |
| `server/` | WebSocket server, match lifecycle (`game.ts`), bots (`bot.ts`, `nav.ts`), rate limiting, env config |
| `client/` | Rendering, prediction, input, HUD and menus |
| `tools/` | Dev bots (`bots.ts`) and perf bench (`bench.ts`) |

## Commands

```bash
npm install
node --run dev:server     # game server on :7350
node --run dev:client     # Vite dev server
node --run test           # node --test (shared + server tests)
node --run typecheck      # tsc for shared (+ tests), server, client and tools
node --run build:client
node --run start:server   # production-style start, no build step
node --run bots           # dev bots against a running server
node --run bench          # tick budget with bots
```

Run `node --run test` and `node --run typecheck` before finishing a change.

To see a change working in the real app, use the project skill `.claude/skills/verify-calindra-strike` (isolated server + client, doctor, dev bots, feature map). The MCP browser has no WebGL, so the in-game 3D view and HUD cannot be verified there; the skill says how to prove the server side instead.

## Debug mode (weapon viewer)

A hidden mode of the client for trying a weapon, its animations and its angle without joining a match. It is an easter egg: on the lobby screen (not while typing in a field) press the Konami code, `↑ ↑ ↓ ↓ ← → ← → B A`. The lobby is replaced by a full-screen viewer that renders the real first-person `ViewModel`, so what you see is what the game draws.

- **Controls.** Pick any weapon and graphics tier, fire once or hold the trigger at the weapon's cadence, play a reload (speed 0.25× to 2×, loop) or drag the reload slider to hold one pose, turn the walking bob on, change the field of view, and move, rotate and scale the gun.
- **Tuning an angle.** `copiar para o código` copies the current placement as one line to paste into `client/src/game/render/weapon-placement.ts`, the table the game reads. `restaurar` goes back to the weapon's own placement.
- **Where it lives.** The trigger is in `client/src/main.ts` with the matcher in `client/src/easter-egg.ts`. The viewer is `client/src/debug/weapon-viewer.ts` (DOM and render loop) and `weapon-debug.ts` (pure reload and auto-fire logic, tested). It is loaded with a dynamic import only when the code is typed, so the normal bundle does not carry it. Its rows come from `client/src/ui/controls.ts`, shared with the pause menu.
- **Needs WebGL.** Without it the viewer only shows a notice and the way back to the lobby, which is what the MCP browser gets. An agent cannot judge the animation there: ask the user to look, or render frames in software from `ViewModel` (stub `document.createElement('canvas')`, then rasterize `view.scene` with `view.camera`), which shows geometry and framing but not motion.
- **When to use it.** Any change to a weapon model, a reload or fire animation, or where the gun sits in the view. Put new weapon-specific controls in the viewer, not in the game.

## Node standard library first

Server, shared code, tests and tools use only what Node (>= 24) ships, plus the exceptions below. Before adding a package or a hand-rolled helper, check whether Node already has it.

- **Run TypeScript natively.** `node file.ts` strips types, there is no `tsx`, bundler or build step for the server. Only erasable syntax is allowed (`erasableSyntaxOnly` is on for shared, server and tools): no `enum`, `namespace` or constructor parameter properties (`constructor(private x: T)`); declare the field and assign it. Keep `.ts` extensions in relative imports.
- **Tests use `node:test` and `node:assert/strict`**, not vitest/jest. Run with `node --run test` (`node --test`). Use `assert.partialDeepStrictEqual` instead of `toMatchObject`, and restore `process.env` in `afterEach` when a test changes it. Shared float helpers live in `shared/test/helpers.ts`.
- **Prefer built-ins:** `node:`-prefixed imports, `util.parseArgs` for CLI args, `--env-file-if-exists` for `.env`, `node --watch` for dev reload, global `fetch`, `WebSocket` (client), `performance.now()`, `structuredClone`, `crypto.randomUUID()`, `AbortSignal.timeout()`, `timingSafeEqual`, `Array#toSorted`, `Object.groupBy`, `Set` methods.
- **Allowed exceptions** (justify any new one in the PR):
  - `ws`: Node has a WebSocket client but no server. It is the only runtime dependency of the server.
  - `typescript` and `@types/*`: type checking only, never executed at runtime.
  - `vite`, `three` and the `@fontsource` packages: browser client bundling and rendering, outside the Node std scope.
- The Docker image copies the sources and runs `server/src/index.ts` directly; keep it free of a build stage.

## Design: clean architecture, clean code, patterns

Prefer these when writing or changing code. Apply them to the code you touch, do not rewrite unrelated files for style.

**Dependency rule.** Dependencies point inward only:

```
client ─┐
        ├─► shared   (domain: simulation, weapons, maps, protocol; imports nothing else)
server ─┘
tools ──► server, shared
```

- `shared/` is the domain core. It must not import from `server/` or `client/`, and must not touch Node or DOM APIs, sockets, timers or `process`.
- `server/` and `client/` never import each other. Anything both need goes into `shared/`.
- Keep I/O at the edges. `Game` (`server/src/game.ts`) is the application layer: it takes plain callbacks and options (`send`, `random`, config) and knows nothing about `ws` or `http`. `server/src/index.ts` is the adapter and composition root: HTTP, WebSocket, origin checks, rate limits, signal handling, and wiring `Config` into `Game`. New transport concerns go there, new game rules go in `Game` or `shared/`.
- Inject what makes code non-deterministic or hard to test (random source, clock, config, send callbacks) through constructors or options, as `GameOptions.random` already does, instead of reaching for globals. Read `process.env` only in `server/src/config.ts`.
- Parse and validate at the boundary (`parseClientMessage`, `loadConfig`), then pass typed values inward. Inner code does not re-validate.

**Clean code.**
- Names say what and why, not how. A function does one thing at one level of abstraction; split `Game` methods that mix rules, scoring and broadcasting rather than adding another branch.
- No magic numbers: tuning values go in `shared/src/constants.ts` or `weapons.ts` with a unit in the name or a comment (ms, units/s).
- Make illegal states unrepresentable: discriminated unions for messages and phases, `readonly` fields, `as const` tables. Avoid `any`, non-null `!` and type assertions outside tests.
- Early returns over deep nesting; no flag arguments; no dead code or commented-out code; comments explain why, not what.
- Small, pure functions in `shared/` first (they are trivially testable), side effects in thin wrappers. New behavior comes with a test next to the layer it lives in.

**Design patterns: use them when they remove a real problem, not by default.**
- *Strategy / table-driven* over long `switch` or `if` chains on mode, weapon or map (game modes, weapon definitions and map registry are already data-driven, extend those tables).
- *Factory / builder* for constructing maps and entities (`MapBuilder`), keeping construction separate from use.
- *Adapter / ports* around external things (sockets, clock, randomness) so the core stays testable with fakes.
- *Observer / callbacks* for events leaving the core (kills, loot, phase changes) instead of the core calling transport code.
- *State machine* for match phases (warmup, live, podium): explicit states and transitions, no scattered booleans.
- Prefer composition over inheritance. Do not add layers, interfaces or abstract classes with a single implementation and no seam to test against.

## Conventions and gotchas

- **Stances and movement.** A player's pose is `PlayerState.stance` (`STANCE.STAND|CROUCH|PRONE`, table `STANCES` in `shared/src/stance.ts`: hull, eye, speed, hitboxes, bot aim heights); read the table, do not branch on the stance. Sprint, stamina, slide, lean and the prone lock are advanced per command in `playerMove` (`shared/src/sim.ts`) from the button bits `SPRINT`, `LEAN_LEFT`, `LEAN_RIGHT`, `PRONE`; tuning is under `SPRINT_`, `STAMINA_`, `SLIDE_`, `LEAN_`, `PRONE_` in `constants.ts`. A lean moves the eye and the shot origin (`eyePosition`) and the head and body hitboxes (`hitboxes(x, y, z, stance, lean, yaw)`), so the server keeps stance, lean and yaw in its lag compensation history. Remote rows carry `RF_PRONE`, `RF_SPRINT`, `RF_SLIDE` and the lean at index 8 (`stanceFromFlags`, `leanOfRow`). Bots never sprint, slide, lean or lie down; MCP agents press them with the `sprint`, `slide`, `lean` and `prone` tools (`ActionOverlay` in `tools/mcp/actions.ts`; its `slideBlocker` mirrors `tryStartSlide`, and `tools/test/actions.test.ts` runs the two against the sim so they cannot drift).

- **Radio lines** are the `RADIO_MENUS` table in `shared/src/radio.ts`; append, never insert or reorder (the wire id is the position). See "Radio lines" in `README.md`.

- **Kill feed weapon icons** are baked at runtime from `buildWeapon` in `client/src/game/render/weapon-icons.ts` (side view, flat light tones, one icon per entry of `WEAPONS`), so a new weapon gets its icon with its model and needs no extra art. A kill by a weapon without a model fails `client/test/weapon-icons.test.ts`. Baking uses a throwaway WebGL renderer on first kill and returns null without WebGL, where the feed shows the text tag.

- **Sound packs** live in `client/src/game/sound-packs/`: export a SoundPack and register it in SOUND_PACKS; omitted voices use classic. Runtime-loaded mods are not supported.

- **Hora de almoçar** rules are pure in `shared/src/lunch.ts` (`stepLunch`, tuning in `constants.ts` under `LUNCH_`). The server runs them in `Game.updateLunch`, reusing `attackers` from debug defusion for the side that leads, and the client draws colleagues with `ColleaguesView` (`client/src/game/render/colleagues.ts`, the player `Avatar` in white). A map plays the mode only when it lists `restaurants` (`MapBuilder.restaurant`), checked by `modeFitsMap` when the rotation is built. MCP agents read it from `get_state.lunch` (built in `describeLunch` in `tools/mcp/view.ts` from the snapshot rows, decoded by `colleagueFromRow`), `hunt` plays it through the same `pickLunchGoal` as the server bots, and `use` calls the colleagues in reach.

- **Day cycle.** The phase (`day`, `afternoon`, `night`) is a pure function of the server clock: `dayCycleAt(serverMs)` in `shared/src/day-cycle.ts`, tuning in `constants.ts` under `DAY_`, no protocol message (the client already tracks `serverNow()`). Each phase's slot ends with a blend into the next. The look is `client/src/game/render/day-look.ts`: `buildLooks(theme)` returns one `DayLook` per phase, the day is the map's `MapTheme` untouched and the others come from the `PHASE_GRADES` table (colours move toward a tint, scales, sun turn and height, exposure, stars, glow), unless the theme sets `phases.afternoon` or `phases.night` to override fields. `ClientGame.updateDayLight` mixes two looks with `lookAt` and hands the result to `WorldView.applyLook` (sky shader uniforms and stars, hemisphere and sun, fog, emissive materials, light halos, distant silhouettes), `ViewModel.setLighting` (the gun) and the renderer exposure. It only writes values: no new lights, passes or per-frame allocations, so it is on every tier, and a settled phase costs nothing. Night must stay readable (players clearly visible at range, fog distance unchanged, no near-black interiors): `day-look.test.ts` asserts a floor on the light that reaches a player, so check it when retuning `PHASE_GRADES`. The benchmark builds the world and never applies a look, so it measures day. A new emissive material that should glow more at night only needs to be a `MeshStandardMaterial` with an emissive colour in `buildWorld`'s material table. MCP agents read the phase from `get_state.timeOfDay`; it is a look only.

- **Store signs** are the `STORE_BRANDS` table in `shared/src/maps/brands.ts` (parody names, `food` or `shop`). A map puts one up with `b.deco(..., brandMat('kfg'))` on a 2:1 panel, and the client draws it from the `SIGNS` table in `client/src/game/render/store-signs.ts`, a `Record<StoreBrand, ...>`, so a brand without a drawing fails the typecheck. Sign mats count as plaster for impacts.

- **Shared code is deterministic.** Client prediction and the server run the same simulation from `shared/`. Do not add randomness, wall-clock time or environment-specific behavior there; use the seeded spread helpers. A change to movement or weapons affects both sides and needs a test in `shared/test/`.
- **Protocol changes:** edit `shared/src/protocol.ts`, the server handler in `server/src/index.ts` / `game.ts`, and the client message handling in `client/src/game/client.ts` (`net.ts` is transport only, the handshake is in `client/src/main.ts`). Bump `PROTOCOL_VERSION` in `shared/src/constants.ts` for incompatible changes. Keep message validation strict, the server treats every client message as untrusted.
- **Server is authoritative.** Hit detection is lag-compensated hitscan (rewind up to 250 ms) at a 60 Hz tick. Never trust client-reported damage or positions.
- **Surfaces and impact sounds.** Every map `Mat` maps to a `Surface` in `shared/src/surface.ts` (the client plays it, the MCP reports it). A surface also needs a sound layer set in `client/src/game/surface-sound.ts` and a spark look in `client/src/game/surface.ts`; both are `Record<Surface, ...>`, so a missing entry fails the typecheck. Coloured sparks and glints are the high tier only (`fx.sparkle` in `quality.ts`), the sounds are on every tier. `CollisionWorld.trace` returns the `mat` it hit.
- **MCP senses.** `get_state.sounds` is built in `tools/mcp/session.ts` from the server's shot and hit events plus the agent's own shots (the server never sends a player their own, so they come from the magazine dropping). Loudness is `heardIntensity` in `shared/src/hearing.ts`, the same curve as the browser's positional audio. `aim` and `fire` are an overlay on the pilot's command in `tools/mcp/actions.ts`.
- **Props and scenery.** A `MapProp` (`shared/src/maps/types.ts`) is scenery the client draws from a model and may animate: ceiling fans, mannequins, clothes racks, escalators, the fountain, vents. Props are never solid and never part of collision or the nav grid; whatever must block stays a `Box`. Author them with `b.prop(...)` (or `b.escalator(...)`, which keeps the stair boxes for collision but hides them) so the 180 degree mirror turns them too. An escalator prop has `travel: 'up' | 'down'` (`MapBuilder.escalator` requires it, the mirror keeps it, `escalatorPhase` runs the steps backwards for `'down'`): it is visual only, the stair boxes and the nav grid are the same. The client keeps one builder per kind in `PROP_BUILDERS` (`client/src/game/render/props.ts`), a `{ [K in PropKind]: ... }` table, so a kind without a drawing fails the typecheck. Static models are merged into one mesh and moving parts are instanced, so a kind costs a few draw calls, not one per object. The pure motion rules (escalator steps, fountain drops, vapour) live in `prop-motion.ts` and are tested. `Box.tint` (`b.deco(..., mat, tint)`) multiplies a material's colour at no extra draw call; use it instead of adding materials. Kitchens and store interiors are authored with `Room` (`room.ts`), a depth-from-the-back-wall frame, in `shopping-kitchens.ts` and `shopping-stores.ts`, as `Record<FoodBrand | ShopBrand, ...>` tables. A food court kitchen is a visible set plus one solid invisible `clip` box, so it can be seen over the counter and never entered.
- **Ambient motion tiers.** `QualityProfile.ambientMotion` (ceiling fans, vent fans, fountain; high and low) and `ventSmoke` (vent vapour; high and low, not built on performance) are table columns, not tier checks. `WorldView.setQuality(profile)` applies a tier chosen mid-match, so a new ambient prop kind reads the profile in its builder's `setQuality` and builds or stops its optional parts there. Escalator steps move on every tier. Vent hum: `Sfx.airLoop` plays a positional filtered-noise loop, and `VentHum` (`client/src/game/vent-hum.ts`) keeps the nearest three vents humming and stops the loops when the map is replaced or the match is left.
- **Maps** live in `shared/src/maps/` and are built with `builder.ts`. Adding a map means registering it in `maps/index.ts`, passing `maps.test.ts` and updating the map x mode combination count asserted in `server/test/config.test.ts`; bots use an auto-generated nav grid (`server/src/nav.ts`), so check bots can walk it. A drop edge needs the lower node's column open up to the higher node, so a floor under an upper floor is not a shortcut; keep railings and escalator sides above jump height or the grid walks over them. Nothing a glider can land on may be out of play: the solid roof top is covered by an invisible `clip` column up past `dropHeight`, and `server/test/landing.test.ts` fails when a surface a glider can land on cannot walk back to the floor. Keep tall pieces under 300 units so a bot can drop from them. How open a map is to long clean shots is measured by `node tools/sightlines.ts [mapId]` (sampled pairs with a clear bullet line, and how far a player sees along a lane); `tools/test/sightlines.test.ts` pins Shopping Sul Rio, whose cover lives in `shopping-cover.ts`. Keep the cover off the benchmark tour (`client/src/benchmark/tours.ts`), a test walks it.
- **No external game assets.** Models, textures and sounds are generated at runtime. The only bundled files are the brand PNGs in `client/public/brand` and the `@fontsource` fonts. Do not add copyrighted or third-party game assets.
- **Config comes from env** (`server/src/config.ts`). A new setting also needs `.env.example`, the README table, an explicit entry in `compose.yaml` (it does not pass the whole environment through) and a case in `server/test/config.test.ts`. Every setting the server or the client build reads is listed in `.env.example`, legacy and build-time ones (`GAME_MODE`, `VITE_GAME_SERVER`) as comments; keep it complete.
- **Backend URL:** the client picks it at build time with `VITE_GAME_SERVER` (`client/src/config.ts`); the CSP `connect-src` in `vercel.json` must agree with it.
- **Hosting and secrets stay out of the repo.** No production URLs, credentials or operator instructions; `.env` files are git-ignored except `.env.example`.
- Game UI text is mostly Portuguese (a few terms such as kills and headshot stay in English); code, comments, commits and docs are in English.

- **Graphics benchmark** lives in `client/src/benchmark/`. Open it from the lobby, from the pause menu (the `benchmark` overlay hook leaves the match and calls `renderLobby(..., benchmark = true)`, so the test never runs beside a live match) or load `?benchmark` with optional `tiers`, `maps`, `rounds`, `ms` and loopback `report` parameters. Read `window.__benchmark` when the title reaches `benchmark:done`. The harness-only `high-no-rt` tier uses high graphics with the screen-space pass disabled. `tours.ts` defines closed walking routes with collision-followed ground height and eased yaw. Keep routes clear of movement solids when editing a map. The lobby overlay updates live FPS, frame timing, CPU and GPU timing, and browser hardware details about four times per second. Run rows and tier summaries expose median `cpuMs` and `gpuMs` per frame. GPU timing requires `EXT_disjoint_timer_query_webgl2` and is `null` when no valid query results are available.

## Keep the performance tier light

The `desempenho` tier exists for weak machines (integrated graphics, old laptops). Never add a heavy feature to it.

- **Off by default.** A new visual or audio feature that costs frame time, draw calls, fill rate, memory or extra scene passes (post-processing, extra lights or shadows, more particles, bigger render targets, reflections, ray-marched passes) is a column in `QualityProfile` in `client/src/game/render/quality.ts`, on only for the tiers that can afford it, and always `false` or zero for `performance`. Say in a comment which tiers have it, as `fx.sparkle` and `lightRt` do (high only).
- **Not a branch on the tier name.** Read the profile, so the decision stays in the table.
- **Gate it at the source.** The cost must not be paid when the tier is off: do not build the objects, render targets or passes, rather than hiding their output. A feature that needs hardware support (WebGL 2, float targets) also checks the card, and falls back when it throws.
- **Test it.** Add a case next to `only the high tier sparkles` in `client/test/` asserting which tiers have it, so a later change cannot switch it on for `performance`.
- **Cheap is allowed.** Gameplay, sound, text and small effects that cost almost nothing run on every tier, as the impact sounds do. When unsure, measure on the performance tier or leave it off.

## Document every new feature

Whenever you add a feature, document it in the same change. A feature that is only in the code is not finished.

- **Players.** Gameplay, controls, modes, graphics tiers, sounds and menus go in `README.md` (the feature list, the controls line or a settings table).
- **Settings.** A new env setting also follows "Config comes from env" below.
- **Agents.** A new MCP tool, a new field in `get_state` or a change in how agents perceive the game goes in `README.md` under "Play with an AI agent (MCP)", in the tool's own `description` (that is what agents read) and in `.claude/skills/play-calindra-strike/SKILL.md`. Then bump the MCP pin (`bump-calindra-strike-mcp` skill). A new input bit in `BTN` (`shared/src/constants.ts`) needs its MCP tool in the same change: `tools/test/mcp-actions-cover.test.ts` maps every `BTN` key to a tool or to the pilot, and fails the tests (and the typecheck) when a key is missing or names a tool that does not exist.
- **Developers.** A hidden mode, a script, a table others extend (surfaces, radio lines, maps) or a rule a future change could break goes here in `AGENTS.md`, next to the closest section.
- Say what it does and where it lives, in the same short style as the rest, and keep numbers that are guesses labelled as tuning values.

## Playing the game (agents)

- For tips on how to play (MCP tools, tactics, chat and personas, team callouts, naming), consult the project skill `.claude/skills/play-calindra-strike/SKILL.md`. Gameplay instructions live only there, not in this file. When you play and learn something new (a tool behaviour, a map pattern, a tactic that worked or failed), merge it into that file instead of writing a new notes file, and keep the existing sections, so the next agent that plays can use it.
- Run the verification server (`verify-calindra-strike`) only to test a change. Do not play on it, because the MCP connection points at the main server on port 7350.

## Git

- `origin` is the `sandhilt` fork, `upstream` is `gabriel-accetta/calindra-strike`.
- Default branch is `main`. Commit messages are short, imperative, in English.
