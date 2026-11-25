---
name: verify-calindra-strike
description: Launch Calindra Strike (browser FPS: Vite client + Node WebSocket game server) in an isolated sandbox and drive it to prove a change works. Use when asked to run the game, check the lobby or a match, exercise server behavior with dev bots, or confirm a client/server change in the real app instead of only in tests.
---

# Verify Calindra Strike

Primary surface is a web UI (`client/`, Vite) talking to an authoritative WebSocket server (`server/`). There is no database and no auth. Server state is observable at `GET /status`, so most proofs combine a browser view with a `/status` read.

Prerequisite: `node` >= 24 and `curl` on PATH (`nix develop` or direnv provides Node). Dependencies installed (`npm install`). Helper scripts live in `scripts/` next to this file and use only recorded pids, never process names.

## Launch

```bash
.claude/skills/verify-calindra-strike/scripts/up.sh
```

Starts the game server on `127.0.0.1:7450` and the Vite dev client on `127.0.0.1:5273` (override with `VERIFY_SERVER_PORT` / `VERIFY_CLIENT_PORT`), refusing if either port is taken. The client is started with `VITE_GAME_SERVER` pointing at that server and the server allows only that client's origin. Defaults make matches short: `MATCH_SECONDS=20`, `PODIUM_SECONDS=3`, `WARMUP_MIN_PLAYERS=1`, `BOT_FILL=0`; export other server env vars (`GAME_MODES`, `GAME_MAPS`, `JOIN_CODE`, ...) before running to change them. It prints `client=... server=... ws=...` and `artifacts=<dir>` when both answer. State and logs go to `$VERIFY_DIR/run` (default `/tmp/calindra-strike-verify`). Empty data dir needs nothing: the game keeps all state in memory.

## Doctor

```bash
.claude/skills/verify-calindra-strike/scripts/doctor.sh
```

Read-only. Checks both processes are the ones this run started, `/status` answers with a protocol number, the client serves the page and was built against our server port, and prints the current `/status`. Run it first whenever anything looks off. Never drive an instance that fails it.

## Drive

Pick a recipe from [features/README.md](features/README.md). Harnesses:

- **Browser:** the Chrome DevTools MCP tools (`new_page`, `take_snapshot`, `fill`, `click`, `take_screenshot`, `list_console_messages`). Take a snapshot first and use the accessible names below; uids change after every navigation or re-render. Lobby handles: textbox `APELIDO`, buttons `Cor 1`..`Cor 12`, weapon buttons by name (`Forja R7`, `Brokkr SMG`, `Trovão 12`), button `jogar agora`, alert region for errors.
- **Server state:** `curl -s http://127.0.0.1:7450/status` (players, bots, map, mode, phase, `endsInMs`, leaders, `codeRequired`).
- **Other players:** `scripts/bots.sh [count] [passive]` starts the repo's dev bots (`tools/bots.ts`) with the right URL and Origin. `passive` bots walk to the nearest player without shooting.
- **Match phases:** `scripts/watch-phase.sh [seconds]` prints each change of phase/map/mode with a timestamp.
- **Raw WebSocket:** Node's global `WebSocket` accepts `{ headers: { Origin } }`, which is how origin enforcement is tested.

## Weapons

Test every weapon change in the weapon viewer, opened by URL in headless Chromium: [features/weapon-viewer.md](features/weapon-viewer.md).

## Graphics benchmark

The benchmark needs only the Vite client. Open `http://127.0.0.1:5273/?benchmark&rounds=1&ms=600` in Chromium, wait for title `benchmark:done`, and capture `window.__benchmark` or the `[benchmark]` console JSON. Verify one run per tier and map, with positive frame counts and canvas dimensions. Check that run rows and tier summaries include median `cpuMs` for main-thread update and submission and `gpuMs` for WebGL 2 GPU elapsed time. Expect `gpuMs: null` if `EXT_disjoint_timer_query_webgl2` is unavailable or the run yields no valid GPU timing samples. Headless Chromium can use `--use-angle=swiftshader --enable-unsafe-swiftshader` to check that the report and overlay work. SwiftShader frame timings are meaningless for graphics recommendations. Use a real GPU for performance measurements.

On the affected browser, use `?benchmark&tiers=high,high-no-rt&maps=shopping&rounds=4` at the same window size. Compare matching map and canvas dimensions and confirm `rt` is true on the high runs before interpreting their difference. For the player path, use **testar desempenho** in the lobby, confirm the camera walks from the same starting view at each tier and turns gradually, and check the top-left panel for progress, FPS, frame time, CPU/GPU ms per frame, GPU name, cores and optional JS heap. With no timer extension the panel shows `GPU: indisponível neste navegador`. Capture the result card with the per-tier timing lines, then verify **usar** updates the selected tier after reload. Esc cancels the run.

## Evidence

Write proofs under `$VERIFY_DIR/artifacts/<feature-id>/` (default `/tmp/calindra-strike-verify/artifacts`). Per proof capture the action and the resulting state:

- Browser: an accessibility snapshot (`take_snapshot` with `filePath`) and a screenshot with the page identity visible.
- Server side effects: the `/status` JSON after the action (a joined player appears in `players` and `leaders`; `server.log` has a `join "<name>"` line).
- Console: `list_console_messages` filtered to errors. Report each error; do not ignore them.

Drive the real path: the lobby form and the real WebSocket, not by importing server code or calling `Game` directly (that is what `npm test` already does). Do not mock anything.

## Cleanup

```bash
.claude/skills/verify-calindra-strike/scripts/down.sh
```

Stops the bots, client and server by recorded pid and removes `$VERIFY_DIR/run`. Artifacts are kept. Close any browser tab you opened (a tab left open keeps a player in the match until the page is closed). Run it after a failed attempt too.

## Known limits

- **No WebGL in the MCP browser.** The Chrome DevTools MCP browser here has no GPU, so Three.js fails with `Could not create a WebGL context` and the in-game view and HUD never render. The lobby, the join (server registers the player), `/status` and bots all work. The weapon viewer is the exception: headless Chromium renders it (see Weapons). Treat anything else that needs the 3D view or HUD (scoreboard, kill feed, podium scene, scope) as unverified, say so, and verify the server side through `/status`, `server.log` and bots instead. Do not report an unrendered HUD as passing.
- **Pointer lock** needs a real user gesture on the canvas; keyboard/mouse gameplay input is not driveable from the MCP browser.
- **Two instances side by side** work only with different `VERIFY_SERVER_PORT` / `VERIFY_CLIENT_PORT` and `VERIFY_DIR`; the scripts refuse a second run on the same ones.
