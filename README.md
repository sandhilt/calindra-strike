# Calindra Strike

> Tiro tático com alma de CS 1.6, direto no navegador. Salte do céu, pouse onde quiser e dispute o pódio.

An original browser FPS with Counter-Strike 1.6 style gameplay, made for the Calindra office:

- **Arena match**: 5 minute rounds with a live leaderboard at the top and a 3D **top-3 podium** at the end, alongside a scrollable full ranking with kills, deaths and headshots for every player from both teams. The rotation cycles through every enabled map + mode pair (`Forja`, `Escritório` × TDM, free-for-all, CTF and debug defusion by default), never repeating the same map or mode back to back. Pick which ones are in play with `GAME_MAPS` and `GAME_MODES`.
- **Team Deathmatch**: **Bulldogs** (lime) vs **Martelos** (blue), no friendly fire, first team to 50 kills (or most kills at the end of the timer) wins. Teams are shuffled and balanced every match, late joiners go to the smaller side, CS-style auto-balance on respawn, and you can switch to the smaller team from the Esc menu. Each side skydives over its own half; the podium shows the winning team's best three.
- **Capture the Flag**: steal the enemy flag and bring it to your base while your own flag is home. First to 3 captures wins; dropped flags return after 30 seconds.
- **Debug defusion**: the attackers carry "o bug", a laptop, to the opposite base and hold **E** for 3 seconds to plant it. The defenders have 30 seconds (15 on a Black Friday round, "50% OFF" the fuse) to stand next to it and hold **E** for 7 seconds, while a laptop screen shows a developer fixing the bug. A defused bug scores for the defenders, an exploded one for the attackers, and the sides swap every round. First to 5 rounds wins; a laptop left on the floor for 20 seconds goes to the other team (nobody scores, the sides swap).
- **Bots** (off by default, enable with `BOT_FILL`): server-side bots fill empty slots (up to `BOT_FILL`) whenever someone is online and leave as people join. They navigate an auto-generated walkable grid (stairs, crate jumps, dropping off roofs), react with human-like delay and aim error, burst-fire and scope the AWP, hunt players and go for airdrops, respect teams in TDM/CTF, and pursue flag objectives in CTF.
- **Map vote**: during the podium everyone votes for the next match (3 map + mode options, keys 1-3 or click); most votes wins, no votes keeps the rotation.
- **Rejoin**: a dropped connection or page refresh gets your score back if you return within 90 s.
- **Air drop**: you skydive into the arena on every (re)spawn and steer to land anywhere (`Ctrl` dives faster). Supply crates parachute in with legendary weapons and full armour: usually the **Mjölnir AWP** (about 2 in 3 crates), otherwise the `Ragnarök` LMG.
- **Mjölnir = CS 1.6 AWP**: right click zooms to FOV 40 then 10 (like CS) with the 1.6 scope overlay and `zoom_sensitivity_ratio 1.2`; 115 damage (one body shot), 10-round mag; 1.6 accuracy table (stand still and scope: 0.001; crouched: perfect; walking 0.10; running 0.25; airborne 0.85; no-scope +0.08, no crosshair); the scope drops while you work the bolt and comes back on its own (right click during the bolt cancels it).
- **Hammer**: equip slot `3` to run at 280 units/s (12% faster than a pistol), with an upright forge hammer held by its grip and a forward swing.
- **CS feel**: GoldSrc movement (ground friction/accel, air strafing, crouch-jump, 1.2x bunny hop cap), spray patterns, first-shot accuracy, run-and-gun penalty, 4x headshots, armour penetration, silent walking with `Shift`, dynamic crosshair.
- **Netcode**: authoritative server at 60 Hz, client-side prediction with reconciliation, 100 ms entity interpolation, lag-compensated hitscan (rewind up to 250 ms), shared deterministic simulation and spread seeds.
- **Calindra × Eitri** look: `#131312` charcoal, `#A5FA00` lime, Inter + Fragment Mono, glass tiles. All art, models and sounds are generated at runtime (no copyrighted assets).

Inspired by the LAN-party approach of [cs16-web](https://github.com/Elkhan-Isayev/cs16-web) (one server container, open a link, type a nickname, play), rebuilt from scratch as an original game so it can be hosted publicly without shipping Valve's game files.

## Architecture

The static browser client connects over WebSocket to an authoritative Node.js game server.

| Path | Purpose |
| --- | --- |
| `client/` | Vite + Three.js rendering, prediction and interface |
| `server/` | WebSocket server, match lifecycle, bots and lag compensation |
| `shared/` | Deterministic movement, collision, weapons, maps and protocol |
| `tools/` | Development bots and performance tools |

## Development

```bash
npm install
node --run dev:server
node --run dev:client
node --run test
node --run typecheck
```

The local client uses `ws://127.0.0.1:7350/ws`. Set `VITE_GAME_SERVER` at build time to use a different backend. Outside localhost, the default is `/ws` on the same origin as the frontend.

### Sound packs

Choose clássico or sound-new in the in-game sound pack menu. The separate anunciador checkbox adds a voice on top of either pack: original Portuguese kill-streak lines through the browser's speech synthesis (no audio files; silent where the browser has none). It only speaks, so shots and flags sound the same with it on or off. Packs live in `client/src/game/sound-packs/`: add a file exporting a SoundPack and register it in SOUND_PACKS in index.ts. Omitted voices fall back to classic. Runtime-loaded mods are not supported.

## Builds and hosting

```bash
node --run build:client
```

Serve `client/dist` as static files and start the game server with `node --run start:server` (Node.js 24 or newer, it runs the TypeScript sources directly with no build step and reads `.env` if present), or use the included Dockerfile and Compose template. Configure the server environment using `.env.example`; `ALLOWED_ORIGINS` must contain the exact frontend origins. Use TLS for public connections. Hosting configuration and credentials belong to the operator's environment.

`vercel.json` is a generic static hosting template with a same-origin Content Security Policy. When using a backend on a different origin, configure both `VITE_GAME_SERVER` and the CSP `connect-src` for that origin in your deployment configuration. This repository does not select a production backend or contain production administration instructions.

## Server settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `GAME_MODES` | `tdm,ffa,ctf,defuse` | Rotation and vote modes: `tdm`, `ffa`, `ctf`, `defuse`, or `all` |
| `GAME_MAPS` | all | Map IDs: `forja`, `escritorio` |
| `CTF_CAPTURE_LIMIT` | `3` | Captures to win; `0` uses the timer only |
| `DEFUSE_SCORE_LIMIT` | `5` | Rounds to win debug defusion; `0` uses the timer only |
| `FRIENDLY_FIRE` | `0` | `1` lets bullets hurt teammates in team modes (a teamkill earns no kill or score); only this setting turns it on |
| `READY_KICK` / `READY_KICK_SECONDS` | `1` / `20` | New players wait on the "pronto" screen, out of the map and untouchable. With `1`, whoever has not confirmed after `READY_KICK_SECONDS` (5-600), or when the match ends, goes back to the lobby; `0` never kicks |
| `IDLE_KICK` / `IDLE_KICK_SECONDS` | `1` / `30` | With `1`, a player with no input (keys, mouse, weapon change; for MCP agents, any tool call) for `IDLE_KICK_SECONDS` (10-3600) goes back to the lobby, warned 10 s before; the podium does not count. `0` never kicks |
| `DEFUSE_PLANT_TIMEOUT_SECONDS` | `60` | Seconds the attackers have to plant before the laptop goes to the other team with a new variation; `0` means no limit |
| `TDM_SCORE_LIMIT` | `50` | Team kill target; `0` uses the timer only |
| `MATCH_SECONDS` / `PODIUM_SECONDS` | `300` / `15` | Match and podium duration |
| `WARMUP_MIN_PLAYERS` | `2` | Players needed to start a match |
| `MAX_PLAYERS` | `24` | Human player limit |
| `BOT_FILL` | `0` | Optional server bot population target |
| `BOT_SKILL` | `50` | Bot skill, 0–100 |
| `JOIN_CODE` | empty | Optional access code |

## Play with an AI agent (MCP)

`tools/mcp/` is a zero-dependency stdio [MCP](https://modelcontextprotocol.io) server that joins the game as an ordinary player, so any MCP-capable harness can play. It needs Node 24 or newer and a running server (`node --run dev:server`).

| Tool | What it does |
| --- | --- |
| `join` / `leave` | Connect with a name, colour and primary weapon, or disconnect |
| `get_state` / `wait` | Read the world (you, nearby players, air drops, flags, score, events), or pause then read |
| `move_to` / `attack` / `hunt` / `stop` | Set a goal. A pilot routes, aims, shoots and reloads between calls |
| `jump` / `crouch` / `zoom` | Jump once (on the ground only), crouch until changed, or set the AWP scope level (0 to 2). Setting `zoom` replaces the pilot's auto-scope until you respawn |
| `walk` / `reload` / `switch_weapon` | Walk silently (`Shift`) until changed, reload (`R`), or switch to `primary`, `pistol`, `hammer` or `last` (`1` `2` `3` `Q`). Switching to the weapon already in hand does nothing |
| `choose_loadout` / `say` / `vote` / `switch_team` | Loadout, chat, map vote and team |
| `radio` | A radio line to the team: `{ menu, line }` from the Z, X, V and B menus (`comandos`, `grupo`, `respostas`, `calindra`) |

The server stays authoritative. The agent is subject to the same origin check, access code, rate limits and player caps as a browser.

The server sends every living player's position to every client, so the MCP filters what it shows. By default an agent perceives an enemy only with a clear line of sight (up to 2600 units) or within 420 units (sound), plus a 10 second `lastSeen` memory, the same rules the server bots use. Pass `--omniscient` to disable the filter for debugging. `--skill` (0 to 1, default 0.7) tunes the pilot, which is the server bot brain. `--auto-vote` (off by default) casts a random map and mode vote when the podium opens; the `vote` tool can still change it. `--log` (off by default) logs joins, leaves, match changes, votes and every tool call to stderr, one line each with an ISO timestamp like the server log; stdout stays reserved for the protocol.

Register it in your harness:

```bash
claude mcp add calindra-strike -- node tools/mcp/launch.ts
codex mcp add calindra-strike -- node tools/mcp/launch.ts
```

Any other harness takes the same command in its MCP config: `command: node`, `args: [tools/mcp/launch.ts]`. Options are `--url` (default `ws://127.0.0.1:7350/ws`), `--origin` (default `http://localhost:5173`) and `--code`.

`get_state` includes `flags` with each team’s flag state (`at_base`, `carried`, `dropped`), carrier id/name, position, distance and bearing. `score.teams` contains team kills in TDM and captures in CTF. Flag events report `take`, `drop`, `return` and `capture`.

For Claude Code there is also a plugin that bundles the MCP and six skills (`play-calindra-strike`, `host-calindra-strike`, and `calindra-strike-combat`, `-navigation`, `-vs-bots`, `-skydive-airdrops`, distilled from the server bot code):

```
/plugin marketplace add ./
/plugin install calindra-strike@calindra-strike
```

The plugin reads `CALINDRA_STRIKE_URL`, `CALINDRA_STRIKE_ORIGIN` and `CALINDRA_STRIKE_CODE` to point at another server.

## Security

The game validates client messages, limits traffic and commands, sanitizes names and chat, checks exact origins, and supports an optional access code. The container runs as non-root with a read-only filesystem, dropped capabilities and resource limits. The Compose template publishes the game port on loopback for use behind a reverse proxy.

## Controls

`WASD` move · `Space` jump · `Ctrl`/`C` crouch (dive while skydiving) · `Shift` walk silently · `1 2 3` / wheel / `Q` weapons · `R` reload · `E` hold to plant or defuse the bug · `G` spray (10 per spawn, 2 s apart) · `Mouse 2` scope · `Tab` scoreboard · `Y` chat · `Z` `X` `V` `B` radio menus (comandos, grupo, respostas, Calindra), then `1`-`9` to pick a line, `0` or the same key to close · `Esc` menu

### Graphics (modo desempenho)

The lobby and the Esc menu have a **gráficos** setting with three tiers: `alta`, `leve` and `desempenho`. Use `desempenho` on weak machines such as laptops with integrated graphics: it draws at about 65% of the window resolution (the canvas still fills the window), turns off sun shadows and edge smoothing, and drops barrel smoke and ejected casings. Gameplay is the same on every tier, only visuals change. Everything applies at once except edge smoothing, which waits for the next join. If a match stays under about 30 fps after the first seconds, a one-time hint suggests the performance tier. The per-tier values live in `client/src/game/render/quality.ts`.

### Watching a match

Choose **só assistir** in the lobby to watch without taking a player slot. A
player can also pick **assistir** in the Esc menu: it leaves the player slot and
rejoins the same server as a spectator. In team modes the spectator bar at the
bottom offers both teams (keys `1` and `2`); pick one within 15 seconds, or on
timeout the server selects the smaller team (ties use the score, then chance).
FFA starts watching immediately. A spectator watches one team at a time and can
switch whenever they like. Returning from FFA to TDM opens a fresh team choice.
Up to 16 spectators can connect independently of the player limit. Spectators
receive chat but cannot send it, play or vote.

The always-visible bar shows who is followed, the camera mode, the team buttons
and key hints. Spectator controls, as in CS 1.6:

- `Space` cycles the camera: first person (you see their weapon with its recoil,
  reload and switch animations, and your own crosshair style at the centre, hidden
  while the target is scoped, skydiving or holding the sniper), third person
  (chase camera behind and above the player, pulled in when a wall is in the way)
  and free camera.
- `Left click` or `→` follows the next player, `Right click` or `←` the previous one.
- Free camera: `WASD` fly along the view, `Shift` faster, `E` up, `Q`/`C` down.
  Click the screen to lock the mouse for looking around and `Esc` to release it.
- `1` / `2` watch the first or second team, `Tab` shows the scoreboard, `Esc` opens the menu.
- `J`, the **entrar no jogo** button on the bar or the one in the Esc menu joins
  the match as a player. If the server is full you keep watching.

Whatever player a spectator follows, planting or defusing the bug shows a progress
bar with who is doing it.
