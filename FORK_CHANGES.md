# Fork changes

What this fork (`sandhilt/calindra-strike`) changed relative to upstream (`gabriel-accetta/calindra-strike`). Kept up to date by the project skill `.claude/skills/record-fork-changes`. This file says what differs and since when. How each feature works is in `README.md` and `AGENTS.md`.

- Upstream compared: `310567f` (`upstream/main`)
- Covered through: `7cbde02`

## Log

Changes made after the baseline, newest day first.

### 2026-11-25
- The lobby offers a fullscreen hint and a button on browsers that support fullscreen (`client/src/ui/lobby.ts`).
- Both Konami debug views can enter and exit browser fullscreen from the panel (`client/src/debug/weapon-viewer.ts`).
- The Konami debug mode now lets players fly through any map and shows FPS, CPU and supported GPU frame timings, JS heap when available, and renderer counts in both views (`client/src/debug/weapon-viewer.ts`).
- Forja, Escritório and Shopping Sul Rio have client-side speaker props for optional positional tracks from `client/public/music/`, with a live `musicVolume` control (tracks are not loaded or played while it is 0). The protocol version stays the same because speakers are local scenery and use no wire fields.
- Hurt server bots and the MCP hunt pilot can charge nearby enemies with the hammer and return to a gun when the rush ends (`server/src/bot-temper.ts`, `server/src/bot.ts`).
- `ViewModel` releases owned weapon resources on weapon or skin changes and frees its remaining resources on exit (`client/src/game/render/viewmodel.ts`).
- Restoring or selecting a weapon resets the reload slider to zero (`client/src/debug/weapon-viewer.ts`).
- Weapon viewer graphics tiers apply pixel density and reflection resolution immediately (`client/src/debug/weapon-viewer.ts`).
- The viewer verification recipe uses the sandbox client port, and the tag lookup test checks resolved weapon IDs directly (`weapon-viewer.md`, `debug-viewer.test.ts`).
- The weapon viewer opens by URL (`?viewer&weapon=<tag>&skin=&aim=&reload=`), reports `viewer:ready` or `viewer:error` in the title and has a skin choice (`client/src/debug/`).
- `AGENTS.md` and the `verify-calindra-strike` skill require every weapon to be in the weapon viewer and agents to test weapon changes there.
- The Azeitadora uses dark materials with lime accents by default and keeps its gold and walnut skin in Carrapeta Dourada matches (`client/src/game/render/weapons3d.ts`).
- The AWP scope lenses on the gun model are the dark blue-green coated glass again, replacing the faint clear green one (`client/src/game/render/weapons3d.ts`).
- The Azeitadora airdrop chance outside Carrapeta Dourada went down from 30% to 20%, below the LMG (`CARRAPETA_AIRDROP_CHANCE`).
- `node --run typecheck` passes again: the `goal` helper in `tools/test/carrapeta-goals.test.ts` has an explicit return type.
- The lobby join card carries a lime “BETA” ribbon (`client/src/ui/lobby.ts`, `client/src/styles.css`).
- Added this history file, the `record-fork-changes` skill that maintains it, and the rule in `AGENTS.md` that every change gets an entry.

## Baseline: upstream `310567f` to `cba52de` (2026-11-14 to 2026-11-25)

469 commits (364 without merges), 376 files, +43900 and -2208 lines. Upstream had no commit missing from the fork. This is the net state of the two trees, so features that were added and later removed are not listed.

### Runtime and tooling

- Node 24 or newer runs the TypeScript sources directly. The server has no bundle step, `tsx`, `esbuild` and the `build:server` script are gone, and the Docker image starts `server/src/index.ts`.
- Tests moved from Vitest to `node:test` and now cover `shared`, `server`, `client` and `tools`. The typecheck includes tests and tools.
- Scripts run with `node --run`, npm is pinned in `packageManager`, and the repo has a Nix flake with a direnv shell.
- New developer scripts: `bench`, `mcp`, `tools/bot-floors.ts` (bot movement report) and `tools/sightlines.ts` (map openness).

### Maps

- New map Shopping Sul Rio (`shopping`): three floors, stores, boutiques, pharmacies, food court kitchens, escalators that carry the rider, a shared glass lift in each half that works as a safe room, supply stands, cover and a water fountain.
- Every map has a day, afternoon and night cycle and is sealed so a glider cannot land outside the walls.
- Map data gained flag bases, defusion bases, restaurants, interiors, lifts, supply stands and scenery props.

### Game modes and match flow

- New modes: capture the flag (`ctf`), debug defusion (`defuse`), hora de almoçar (`almoco`, Shopping only) and Carrapeta Dourada (`carrapeta`). The default rotation went from `tdm,ffa` to all six.
- In Shopping debug defusion the attackers start on the Mirante and plant at the ground floor fountain. A bug already planted scores when the match ends, and a dead player follows living teammates.
- Respawn went from 3 s to 5 s, and 12 s in the objective modes. In Carrapeta Dourada, dying while nobody holds it adds 8 s.
- Mode twists: Black Friday rounds halve the defusion fuse, each lunch round names a target restaurant and may be a faster rush hour, and in Carrapeta Dourada only fights with the holder deal damage while somebody holds it, with a rare Batata Quente frenzy.
- Players confirm "pronto" before entering and again after each podium, idle players are kicked, and warmup has infinite reserve ammo.
- Spectator mode with team choice and camera modes.
- Optional friendly fire.

### Weapons and movement

- Sprint with stamina, slide, lean and prone. Silent walk moved from `Shift` to `Alt`.
- Aim down sights for the pistol, rifle, SMG, shotgun and machine gun. The rifle has a red dot.
- The shotgun reloads shell by shell.
- New weapon Azeitadora, a grenade launcher used by the Carrapeta holder. It also drops from airdrops in other modes (30% chance, tuning value).
- Wall and floor sprays.

### Client

- Graphics tiers (`alta`, `leve`, `desempenho`), contact shadow levels and a benchmark.
- Remappable controls, pause menu tabs, primary weapon choice on the "pronto" screen and a weapon side setting.
- Stamina bar, stance icon, role chips, objective banners and weapon icons in the kill feed.
- Animated reloads, AWP bolt, machine gun belt, casings and barrel smoke, and reworked tracers.
- Per surface impact sounds, selectable sound packs, a kill streak announcer, water splashes and ambient loops.
- Radio menus (keys Z, X, V, B and N) with synthesized speech.
- Hidden weapon viewer (Konami code), new lobby cover and a GitHub button.

### Bots

- Bots play every objective mode, patrol around objectives, use lifts, handle stairs better, visit stores and rooms, and talk in chat and radio.
- Sight range now follows `BOT_SKILL`, as aim and reaction already did, and bots turn their view smoothly. Dev bots (`tools/bots.ts`) follow `BOT_SKILL` and play the objectives too.

### AI agents

- New stdio MCP server in `tools/mcp/` that joins as an ordinary player, with line of sight and hearing limits.
- Claude Code plugin (`.claude-plugin/`, `.mcp.json`), `opencode.json`, six skills in `skills/` for playing and hosting, and one for documenting features.
- Project skills in `.claude/skills/` for playing, verifying and bumping the MCP pin.
- `AGENTS.md` and `CLAUDE.md` with the project rules.

### Protocol and server settings

- `PROTOCOL_VERSION` went from 7 to 24, so upstream clients and servers do not interoperate with the fork.
- New settings: `CTF_CAPTURE_LIMIT`, `DEFUSE_SCORE_LIMIT`, `DEFUSE_PLANT_TIMEOUT`, `DEFUSE_PLANT_TIMEOUT_SECONDS`, `CARRAPETA_PICKUP_TIMEOUT_SECONDS`, `RESPAWN_OBJECTIVE_SECONDS`, `FRIENDLY_FIRE`, `READY_KICK`, `READY_KICK_SECONDS`, `IDLE_KICK`, `IDLE_KICK_SECONDS`, `IDLE_KICK_WARMUP_SECONDS`, `RADIO_COOLDOWN_SECONDS`, `RADIO_MAX_PER_WINDOW` and `RADIO_WINDOW_SECONDS`.
