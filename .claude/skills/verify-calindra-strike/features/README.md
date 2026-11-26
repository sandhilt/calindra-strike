# Calindra Strike verification map

Maintained source for verifying user-facing behavior. Read this index, then the matching feature file.

## Baseline preconditions

- `scripts/up.sh` has started the sandbox and `scripts/doctor.sh` passes.
- Server `127.0.0.1:7450`, client `127.0.0.1:5273`, `MATCH_SECONDS=20`, `PODIUM_SECONDS=3`, `WARMUP_MIN_PLAYERS=1`, no bots, no join code.
- `/status` shows `players: 0` before a recipe starts.
- Never drive an instance this run did not start.

## Driving conventions

- Start each recipe from the baseline state; re-run `down.sh` and `up.sh` if a recipe changed server env.
- Take a fresh snapshot before using uids. Use accessible names, not positions.
- Run browser actions with the Chrome DevTools MCP tools; read server state from `/status` and `$VERIFY_DIR/run/server.log`.
- Close the browser tab when done, it holds a player slot until closed.

## Proof and skip reporting

- Capture the action and the resulting state: snapshot + screenshot + `/status` JSON.
- Record the feature ID with every artifact folder (`artifacts/<feature-id>/`).
- Anything that needs the 3D view or HUD is unverified in the MCP browser (no WebGL). Report it as unverified with the console error, never as passing.
- Report an unreachable path with the attempted command and the unmet precondition.

## Features

- [Join from the lobby](./join-lobby.md): nickname, color and weapon selection, joining a match, errors.
- [Match flow](./match-flow.md): warmup, live, podium and the next map in the rotation.
- [Access control](./access-control.md): allowed origins and the optional join code.
- [Spectating](./spectate.md): timed team choice, independent spectator capacity, server broadcasts and action restrictions.
- [Remap match controls](./rebind-controls.md): keyboard and mouse capture, conflicts, resets and persistence in a WebGL-capable browser.
- [Shopping debug defusion](./shopping-defusion.md) covers both Mirante bases, the laptop and the climb.
- [Carrapeta Dourada](./carrapeta.md) covers possession, the Azeitadora and Batata Quente.
- [Map speakers](./map-speakers.md) covers asset loading and the music control in an audio-capable browser.
- [Weapon viewer](./weapon-viewer.md): weapon models, skins, aim and reload poses, in headless Chromium.
