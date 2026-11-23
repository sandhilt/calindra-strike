# Calindra Strike

> Tiro tático com alma de CS 1.6, direto no navegador. Salte do céu, pouse onde quiser e dispute o pódio.

An original browser FPS with Counter-Strike 1.6 style gameplay, made for the Calindra office:

- **Shopping Sul Rio**: a two floor mall built around a fountain under a glass roof. Stores on the ground floor, the food court upstairs, four escalators between the floors. Every storefront carries a parody sign drawn in code (KFG, Burguer Rei, Mania de Picanha, Méqui, ZARRA, C&Á and more). Every food court counter has a full kitchen behind it that you see over the counter but cannot enter (fryers, griddle and drinks machine for the fast food places, grill, ovens and pots for the restaurants), with tables and spinning ceiling fans in front. Each store has its own look: mannequins in the shop's colours, clothes racks with hangers, bookshelves and a reading corner, shelves of chocolates, aisles of goods. The escalator steps travel, the fountain has a jet and falling water, and ventilation ducts with grilles, fans and a faint wisp of vapour hum quietly when you pass them. Cover breaks the long lanes: ad boards across the covered gallery in front of the stores, a car on display, an information desk, carts, planters with hedges, benches and tall ad columns in the atrium, and menu boards and hedges in the food court, so a clean shot across the mall is rare.
- **Arena match**: 5 minute rounds with a live leaderboard at the top and a 3D **top-3 podium** at the end, alongside a scrollable full ranking with kills, deaths and headshots for every player from both teams. The rotation cycles through every enabled map + mode pair (`Forja`, `Escritório`, `Shopping Sul Rio` × TDM, free-for-all, CTF and debug defusion by default, plus hora de almoçar on maps with a food court), never repeating the same map or mode back to back. Pick which ones are in play with `GAME_MAPS` and `GAME_MODES`.
- **Team Deathmatch**: **Bulldogs** (lime) vs **Martelos** (blue), no friendly fire, first team to 50 kills (or most kills at the end of the timer) wins. Teams are shuffled and balanced every match, late joiners go to the smaller side, CS-style auto-balance on respawn, and you can switch to the smaller team from the Esc menu. Each side skydives over its own half; the podium shows the winning team's best three.
- **Capture the Flag**: steal the enemy flag and bring it to your base while your own flag is home. First to `CTF_CAPTURE_LIMIT` captures wins (3 by default; `0` plays to the timer); dropped flags return after 30 seconds.
- **Hora de almoçar**: hostage rescue, CS 1.6 style, on the Shopping Sul Rio. Three colleagues (the players' own model, all in white) wait at the defenders' base. An attacker holds **E** next to them and they follow, walking the same path, escalators included. A colleague who reaches a restaurant counter in the food court sits down. Seat all three and the attackers win the round; when the 90 second round timer runs out, "acabaram os lugares na praça de alimentação" and the defenders win it. A leader who dies leaves the colleagues where they stand. The sides swap every round and the first to 4 rounds wins. The warmup plays the same rounds without scoring.
- **Debug defusion**: the attackers carry "o bug", a laptop, to the opposite base and hold **E** for 3 seconds to plant it. The defenders have 30 seconds (15 on a Black Friday round, "50% OFF" the fuse) to stand next to it and hold **E** for 7 seconds, while a laptop screen shows a developer fixing the bug. A defused bug scores for the defenders, an exploded one for the attackers, and the sides swap every round. First to `DEFUSE_SCORE_LIMIT` rounds wins (5 by default; `0` plays to the timer); a laptop left on the floor for 20 seconds goes to the other team (nobody scores, the sides swap). The warmup is practice: either team can take, plant and defuse, and there is no fuse, plant window, floor timer or Black Friday, so a team can fool around until the match starts. Players who respawn never land within 800 units of the bomb site.
- **Bots** (off by default, enable with `BOT_FILL`): server-side bots fill empty slots (up to `BOT_FILL`) whenever someone is online and leave as people join. They navigate an auto-generated walkable grid (stairs, crate jumps, dropping off roofs), react with human-like delay and aim error, burst-fire and scope the AWP, hunt players and go for airdrops, respect teams in TDM/CTF, and pursue flag objectives in CTF.
- **Map vote**: during the podium everyone votes for the next match (3 map + mode options, keys 1-3 or click); most votes wins, no votes keeps the rotation.
- **Rejoin**: a dropped connection or page refresh gets your score back if you return within 90 s.
- **Air drop**: you skydive into the arena on every (re)spawn and steer to land anywhere (`Ctrl` dives faster). Supply crates parachute in with legendary weapons and full armour: usually the **Mjölnir AWP** (about 2 in 3 crates), otherwise the `Ragnarök` LMG.
- **Mjölnir = CS 1.6 AWP**: right click zooms to FOV 40 then 10 (like CS) with the 1.6 scope overlay and `zoom_sensitivity_ratio 1.2`; 115 damage (one body shot), 10-round mag; 1.6 accuracy table (stand still and scope: 0.001; crouched: perfect; walking 0.10; running 0.25; airborne 0.85; no-scope +0.08, no crosshair); the scope drops while you work the bolt and comes back on its own (right click during the bolt cancels it). Working the bolt throws the spent cartridge out of the port on a short arc to the lower right of the view.
- **Hammer**: equip slot `3` to run at 280 units/s (12% faster than a pistol), with an upright forge hammer held by its grip and a forward swing. The left hand hangs loose in the lower left of the view.
- **Day, afternoon and night**: every map runs a 15 minute cycle (day 7 min, afternoon 4, night 4, each phase blending into the next over its last 30 s). Day is the map's own look. The afternoon is golden hour, with a low warm sun and long shadows. The night has stars, a moon from another side, a cool dim light and brighter store signs, screens and lamp halos. It stays readable on purpose (players are as visible as by day, and sight range does not change), and it is only a look: bots, agents and the rules play the same. All players see the same phase because it comes from the server clock, and the kill feed says when it changes ("fim de tarde", "anoitecendo…", "amanheceu"). It costs a few uniform writes per frame, so every graphics tier has it.
- **Kill feed with weapon icons**: each kill shows the weapon as a light silhouette, Counter-Strike style, drawn from the weapon's own 3D model (the text tag stands in when the browser has no WebGL).
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

### Radio lines (Calindra menu)

The radio menus (Z, X, V and B) are one table, `RADIO_MENUS` in `shared/src/radio.ts`. The in-game menu, the server's validation, the MCP `radio` tool and the bots all read it, so a new Calindra line is one entry there:

```ts
{
  id: 'calindra',
  // ...
  lines: [
    { text: 'Borumbaaa!', speech: 'Borumbá!' },
    // ...
    { text: 'Eiiiitriiiiii!', speech: 'Êitri!' },
    { text: 'Your new line!' },
  ],
},
```

- **Append at the end.** The wire carries an id built from the position (menu number times ten plus the slot, so the Calindra lines are 41-49). Inserting or reordering changes what the existing ids mean for a client or an MCP agent built before the change.
- **Nine lines at most.** Players pick a line with the digits 1-9; a test fails past nine.
- **`speech` is optional.** `text` is what the feed and the menu show. Add `speech` when the text reads badly aloud (stretched letters, English words, acronyms), with the spelling the browser's speech synthesis should say.
- **Bots use it on their own.** Server bots and dev bots draw from the whole Calindra menu now and then (`BOT_RADIO_LINES.calindra` in `shared/src/bot-radio.ts`). To have bots say it on a specific moment instead (round start, enemy down, a plant), add its exact `text` to that trigger's list in the same file.
- **Update the agreed lines.** The first test in `shared/test/radio.test.ts` lists each menu's size and the Calindra texts on purpose, so a changed line shows up in review. Add the new one there, then run `node --run test` and `node --run typecheck`.
- **Ship server and client together.** A server without the line drops it as an unknown id, silently. Old clients still work, they just do not offer it. No `PROTOCOL_VERSION` bump is needed.
- **MCP agents.** The `radio` tool lists the lines in its description, so agents see the new one once their MCP runs the new code. For an MCP pinned to a commit (see the `bump-calindra-strike-mcp` skill), bump the pin after pushing.

## Builds and hosting

```bash
node --run build:client
```

Serve `client/dist` as static files and start the game server with `node --run start:server` (Node.js 24 or newer, it runs the TypeScript sources directly with no build step and reads `.env` if present), or use the included Dockerfile and Compose template. Configure the server environment using `.env.example`; `ALLOWED_ORIGINS` must contain the exact frontend origins. Use TLS for public connections. Hosting configuration and credentials belong to the operator's environment.

`vercel.json` is a generic static hosting template with a same-origin Content Security Policy. When using a backend on a different origin, configure both `VITE_GAME_SERVER` and the CSP `connect-src` for that origin in your deployment configuration. This repository does not select a production backend or contain production administration instructions.

## Server settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `GAME_MODES` | `tdm,ffa,ctf,defuse,almoco` | Rotation and vote modes: `tdm`, `ffa`, `ctf`, `defuse`, `almoco`, or `all`. `almoco` only pairs with maps that have a food court (`shopping`) |
| `GAME_MAPS` | all | Map IDs: `forja`, `escritorio`, `shopping` |
| `CTF_CAPTURE_LIMIT` | `3` | Captures to win; `0` uses the timer only |
| `DEFUSE_SCORE_LIMIT` | `5` | Rounds to win debug defusion; `0` uses the timer only |
| `FRIENDLY_FIRE` | `0` | `1` lets bullets hurt teammates in team modes (a teamkill earns no kill or score); only this setting turns it on |
| `READY_KICK` / `READY_KICK_SECONDS` | `1` / `180` | Players wait on the "pronto" screen, out of the map and untouchable, when they join and again when each new match starts after the podium (the click that grabs the mouse back confirms it, and so do Enter and Space; the weapon box on that screen ends with a lime `↵ Jogar` row). With `1`, whoever has not confirmed after `READY_KICK_SECONDS` (5-600), or when the match ends, goes back to the lobby; `0` never kicks |
| `IDLE_KICK` / `IDLE_KICK_SECONDS` / `IDLE_KICK_WARMUP_SECONDS` | `1` / `60` / `300` | With `1`, a player with no input (keys, mouse, weapon change; for MCP agents, any tool call) for `IDLE_KICK_SECONDS` (10-3600) goes back to the lobby, warned 10 s before; during the warmup the limit is `IDLE_KICK_WARMUP_SECONDS` (10-3600) instead, and the clock restarts when the match starts; the podium does not count. `0` never kicks |
| `RADIO_COOLDOWN_SECONDS` / `RADIO_MAX_PER_WINDOW` / `RADIO_WINDOW_SECONDS` | `1.5` / `3` / `10` | Radio spam guard per player: minimum gap between lines (0-30 s, decimals allowed, like CS 1.6 `mp_radio_timeout`), then at most `RADIO_MAX_PER_WINDOW` lines (0-100, 0 = no cap) in any `RADIO_WINDOW_SECONDS` (1-600). Extra lines are dropped silently |
| `DEFUSE_PLANT_TIMEOUT` / `DEFUSE_PLANT_TIMEOUT_SECONDS` | `1` / `30` | With `1`, the laptop goes to the other team with a new variation when the attackers have not planted after `DEFUSE_PLANT_TIMEOUT_SECONDS` (0-3600, `0` means no limit). `0` turns the timeout off |
| `TDM_SCORE_LIMIT` | `50` | Team kill target; `0` uses the timer only |
| `MATCH_SECONDS` / `PODIUM_SECONDS` | `300` / `15` | Match and podium duration |
| `WARMUP_MIN_PLAYERS` | `2` | Players needed to start a match |
| `MAX_PLAYERS` | `24` | Human player limit |
| `BOT_FILL` | `0` | Optional server bot population target |
| `BOT_SKILL` | `50` | Bot skill, 0–100: reaction time, first-shot aim error and turn speed. The dev bots (`node --run bots`, which reads `.env`) use it too |
| `JOIN_CODE` | empty | Optional access code |

## Play with an AI agent (MCP)

`tools/mcp/` is a zero-dependency stdio [MCP](https://modelcontextprotocol.io) server that joins the game as an ordinary player, so any MCP-capable harness can play. It needs Node 24 or newer and a running server (`node --run dev:server`).

| Tool | What it does |
| --- | --- |
| `join` / `leave` | Connect with a name, colour and primary weapon, or disconnect |
| `get_state` / `wait` | Read the world (you, nearby players, air drops, flags, the debug defusion bug, the hora de almoçar colleagues and restaurants, score, events), or pause then read |
| `move_to` / `attack` / `hunt` / `stop` | Set a goal. A pilot routes, aims, shoots and reloads between calls |
| `aim` / `fire` | Free aim. `aim` holds the crosshair on a world point (`x`, `y`, `z`) or at an angle (`yaw_deg`, `pitch_deg`, pitch up positive) with the pilot standing still, and answers with the material and surface a shot would hit. `fire` holds the trigger for `ms` (50 to 5000, default 150). Any `move_to`, `attack`, `hunt` or `stop` gives the view back to the pilot |
| `use` | Hold USE standing still: plant or defuse the bug, or as an attacker in hora de almoçar call the colleagues within 80 units. `hunt` already does both on its own |
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

`get_state` includes `sounds`, what the agent heard since its last read: `shot` (with weapon and who fired), `impact` (with the `material` and `surface` it landed on) and `hurt`. Each carries `distance`, `bearingDeg` (positive to the right), `intensity` (0 to 1, the same inverse-distance curve the browser audio uses, full inside the reference distance of 260 units for shots and 200 for impacts) and `loudness` (`loud` from 0.5, `medium` from 0.2, `faint` below). Sounds quieter than 0.08 are not reported, and at most 12 are returned, loudest first. The server never sends a player their own shots, so those are worked out from the magazine dropping and the impact is where the crosshair meets the map; hammer swings make no sound here.

`get_state` includes `timeOfDay` (`phase` `day`, `afternoon` or `night`, the `next` phase and the `blend` toward it, 0 to 1). It only says what the light looks like: agents perceive the same at night.

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

`WASD` move · `Space` jump · `Ctrl`/`C` crouch (dive while skydiving) · `Shift` walk silently · `1 2 3` / wheel / `Q` weapons · `R` reload · `E` hold to plant or defuse the bug · closing the tab or window mid-match asks first, because Ctrl+W is crouch plus forward · `G` spray (10 per spawn, 2 s apart) · `Mouse 2` scope · `Tab` scoreboard · `Y` chat · `Z` `X` `V` `B` radio menus (comandos, grupo, respostas, Calindra), then `1`-`9` to pick a line, `0` or the same key to close · `Esc` menu

### Graphics (modo desempenho)

The lobby and the Esc menu have a **gráficos** setting with three tiers: `alta`, `leve` and `desempenho`. Use `desempenho` on weak machines such as laptops with integrated graphics: it draws at about 65% of the window resolution (the canvas still fills the window), turns off sun shadows and edge smoothing, and drops barrel smoke and ejected casings. Gameplay is the same on every tier, only visuals change. Everything applies at once except edge smoothing, which waits for the next join. The moving scenery follows the tier too: ceiling fans, vent fans, the fountain's water and jet, and the vent vapour run on `alta` and `leve` and stand still on `desempenho` (the vapour is not even built there). The escalator steps keep moving on every tier. The vent hum is a sound, so it plays on every tier. If a match stays under about 30 fps after the first seconds, a one-time hint suggests the performance tier. The per-tier values live in `client/src/game/render/quality.ts`.

Only `alta` has the extras. Bullet impacts throw sparks coloured by the surface, with long yellow glints on metal, containers and concrete (`fx.sparkle`). And a light, screen-space take on ray-traced lighting adds contact shadow in corners and under cover (`lightRt`): WebGL has no hardware ray tracing, so it is an ambient-occlusion pass that marches rays through the depth buffer. It runs only on a real WebGL 2 card with room for the extra passes (`client/src/game/render/rt-support.ts`), never on a software renderer, and switches itself off for good if it ever throws.

The benchmark always draws full day, so runs stay comparable.

### Benchmark

In the lobby, choose **testar desempenho** next to the graphics settings. The camera walks a fixed route through each map at player walking speed, with eased turns. Short runs cover the start of the route. The live panel shows the current tier, map and progress, FPS averaged over roughly half a second, frame time, CPU and GPU time per frame, the GPU name when exposed by the browser, logical cores and JS heap size when available. The result card shows average FPS, the share of frames within the 60 fps budget with a 5% tolerance, and median CPU and GPU time per tier. It recommends the highest tier that reaches 90%, or the tier with the best percentage if none reaches 90%. Use the result card to save that tier. The results apply to the current browser and window size.

To run without the lobby, open `/?benchmark&tiers=high,high-no-rt,low,performance&maps=forja,escritorio,shopping&rounds=2&ms=3000`. All maps and the three player tiers are the defaults, with one round and 3000 ms of measurement after a 1000 ms warmup per run. `high-no-rt` matches `high` with screen-space lighting disabled and is excluded from recommendations. Read `window.__benchmark` when the title is `benchmark:done`, or capture the `[benchmark]` console line. Each run and tier has median `cpuMs` and `gpuMs` fields. CPU time is wall time around the main-thread update and render submission. GPU time comes from nonblocking WebGL 2 timer queries via `EXT_disjoint_timer_query_webgl2`. `gpuMs` is `null` when no valid query result is available. On a dev server you can also pass a URL-encoded HTTP(S) loopback collector as `report` for a no-CORS JSON POST to `localhost` or `127.0.0.1`.

### Impact sounds

A bullet sounds different on each surface, on every tier. The 20 map materials fall into 13 surfaces (`ground`, `concrete`, `plaster`, `brick`, `tile`, `metal`, `container`, `wood`, `crate`, `glass`, `screen`, `cloth`, `plant`) in `shared/src/surface.ts`, and each surface is a short stack of synthesised layers in `client/src/game/surface-sound.ts` (no sample files). Glass, plants and the lime trim let bullets through, so they never make an impact sound. A new material needs a surface, a sound layer set and a spark look, or the typecheck fails.

### Weapon side

The Esc menu has a **lado da arma** setting, `direita` (default) or `esquerda`. The first-person gun and its hands are mirrored to the left of the view, including the kick, the reload roll and the bolt cycle (the cartridge arc flips too). It applies at once and is saved with the other settings; other players' models do not change. The mirror is a group above the kick group in `client/src/game/render/viewmodel.ts`, and the weapon viewer (debug mode) has a `canhoto` switch to preview it.

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
  while the target is scoped, skydiving or holding the sniper), locked third person
  (chase camera on the player's back, turning with their view), free third person
  (the mouse orbits the camera around the player; click once to lock the mouse) and
  free camera. Both third-person cameras are pulled in when a wall is in the way.
- `Left click` or `→` follows the next player, `Right click` or `←` the previous one.
- Free camera: `WASD` fly along the view, `Shift` faster, `E` up, `Q`/`C` down.
  Click the screen to lock the mouse for looking around and `Esc` to release it.
- `1` / `2` watch the first or second team, `Tab` shows the scoreboard, `Esc` opens the menu.
- `J`, the **entrar no jogo** button on the bar or the one in the Esc menu joins
  the match as a player. If the server is full you keep watching.

Whatever player a spectator follows, planting or defusing the bug shows a progress
bar with who is doing it.
