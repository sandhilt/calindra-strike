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

- **Sound packs** live in `client/src/game/sound-packs/`: export a SoundPack and register it in SOUND_PACKS; omitted voices use classic. Runtime-loaded mods are not supported.

- **Shared code is deterministic.** Client prediction and the server run the same simulation from `shared/`. Do not add randomness, wall-clock time or environment-specific behavior there; use the seeded spread helpers. A change to movement or weapons affects both sides and needs a test in `shared/test/`.
- **Protocol changes:** edit `shared/src/protocol.ts`, the server handler in `server/src/index.ts` / `game.ts`, and the client message handling in `client/src/game/client.ts` (`net.ts` is transport only, the handshake is in `client/src/main.ts`). Bump `PROTOCOL_VERSION` in `shared/src/constants.ts` for incompatible changes. Keep message validation strict, the server treats every client message as untrusted.
- **Server is authoritative.** Hit detection is lag-compensated hitscan (rewind up to 250 ms) at a 60 Hz tick. Never trust client-reported damage or positions.
- **Maps** live in `shared/src/maps/` and are built with `builder.ts`. Adding a map means registering it in `maps/index.ts`, passing `maps.test.ts` and updating the map x mode combination count asserted in `server/test/config.test.ts`; bots use an auto-generated nav grid (`server/src/nav.ts`), so check bots can walk it.
- **No external game assets.** Models, textures and sounds are generated at runtime. The only bundled files are the brand PNGs in `client/public/brand` and the `@fontsource` fonts. Do not add copyrighted or third-party game assets.
- **Config comes from env** (`server/src/config.ts`). A new setting also needs `.env.example`, the README table, an explicit entry in `compose.yaml` (it does not pass the whole environment through) and a case in `server/test/config.test.ts`. Some existing settings (`PORT`, `HOST`, `MAX_PER_IP`, `AIRDROP_FIRST_SECONDS`, `TRUST_PROXY`) are not documented yet.
- **Backend URL:** the client picks it at build time with `VITE_GAME_SERVER` (`client/src/config.ts`); the CSP `connect-src` in `vercel.json` must agree with it.
- **Hosting and secrets stay out of the repo.** No production URLs, credentials or operator instructions; `.env` files are git-ignored except `.env.example`.
- Game UI text is mostly Portuguese (a few terms such as kills and headshot stay in English); code, comments, commits and docs are in English.

## Playing the game (agents)

- For tips on how to play (MCP tools, tactics, chat and personas, team callouts, naming), consult the project skill `.claude/skills/play-calindra-strike/SKILL.md`. Gameplay instructions live only there, not in this file. When you play and learn something new (a tool behaviour, a map pattern, a tactic that worked or failed), merge it into that file instead of writing a new notes file, and keep the existing sections, so the next agent that plays can use it.
- Run the verification server (`verify-calindra-strike`) only to test a change. Do not play on it, because the MCP connection points at the main server on port 7350.

## Git

- `origin` is the `sandhilt` fork, `upstream` is `gabriel-accetta/calindra-strike`.
- Default branch is `main`. Commit messages are short, imperative, in English.
