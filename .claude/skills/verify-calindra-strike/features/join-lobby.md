# Join from the lobby

A player opens the page, picks a nickname, color and primary weapon, and joins the running match.

## Sub-features

- `lobby-status` shows live server info (players online, map, mode, phase) before joining.
- `lobby-validate` rejects an empty nickname with an inline error.
- `lobby-join` registers the player on the server and starts the match when warmup needs one player.
- `lobby-loadout` keeps the chosen color and weapon (`aria-pressed`).

## How to get to it (user POV)

- Open `http://127.0.0.1:5273/`, fill `APELIDO`, optionally choose `Cor N` and a weapon, choose `jogar agora`.
- Press Enter inside the nickname field to submit the form.

## Driving it with Chrome DevTools MCP

Preconditions: baseline sandbox, `/status` reports `players: 0` and `phase: "warmup"`.

- **Open.** `new_page` with `http://127.0.0.1:5273`, then `take_snapshot` to `artifacts/join-lobby/lobby.aria.txt`. The form shows `Arena vazia: chegue primeiro`, `0/24 online` and a focused textbox `APELIDO`.
- **Validate.** `fill` `APELIDO` with an empty value (the lobby remembers the last nickname), then `click` `jogar agora`. The alert region (`alert`) reads `Escolha um apelido (letras e números).`, the textbox keeps focus, and no `join` line appears in `server.log`. Screenshot to `artifacts/join-lobby/validate-empty-nick.png`.
- **Choose loadout.** `fill` `APELIDO` with `Verifier`, `click` the weapon button `Brokkr SMG`. Its snapshot entry shows `pressed` and `Forja R7` no longer does. `take_screenshot` to `artifacts/join-lobby/lobby-filled.png`.
- **Join.** `click` `jogar agora`. Wait 2 s, then `curl -s http://127.0.0.1:7450/status`: `players` is 1, `phase` is `live`, `leaders` contains `Verifier`, and `server.log` has `join "Verifier" players=1`. Save the JSON to `artifacts/join-lobby/status-after-join.json`.
- **Proof.** The `/status` JSON plus the `server.log` line are the proof of the join. Also save `take_snapshot` to `artifacts/join-lobby/in-game.aria.txt` and the console errors.
- **Leave.** Close the tab. `/status` returns to `players: 0`.

## Gotchas

- The MCP browser has no WebGL: after `jogar agora` the console shows `THREE.WebGLRenderer: A WebGL context could not be created`, the lobby stays on screen (now reading `Partida rolando` and `1/24 online`) and the HUD never appears. The join itself is real; judge it from `/status` and `server.log`, and report the in-game view as unverified.
- A page reload within 90 s rejoins with the old score (the server keeps a ghost), so use a fresh nickname or wait for a clean run when checking `players` counts.
- Nickname, color and weapon persist in the browser's local storage, so a reopened lobby is prefilled (e.g. `Verifier` and `Brokkr SMG` pressed). That also proves `lobby-loadout`. Clear the fields explicitly when a recipe needs a blank start.
- Labels are uppercase in the accessibility tree (`APELIDO`) because of CSS.
