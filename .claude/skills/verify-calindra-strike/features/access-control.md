# Access control

The server accepts WebSocket connections only from allowed web origins and, when `JOIN_CODE` is set, only from players who send the code.

## Sub-features

- `ac-origin` a connection from an origin not in `ALLOWED_ORIGINS` is refused during the upgrade.
- `ac-code` with `JOIN_CODE` set, the lobby shows an access-code field and a wrong code is rejected.

## How to get to it (user POV)

- Opening the game from the allowed frontend origin works; opening it from anywhere else cannot connect.
- With a join code configured the lobby asks for `código de acesso`.

## Driving it with Node WebSocket

Preconditions: baseline sandbox.

- **Origin.** Run `node -e` with Node's global `WebSocket`: connect to `ws://127.0.0.1:7450/ws` once with `{ headers: { Origin: 'http://127.0.0.1:5273' } }` and once with `Origin: 'http://evil.example'`. Observed: the allowed origin fires `open`, the foreign one fires `error` (HTTP 403 during upgrade). Save both results to `artifacts/access-control/origin-check.txt`.
- **Join code (needs restart).** `scripts/down.sh`, then `JOIN_CODE=letmein scripts/up.sh`. `/status` reports `"codeRequired": true`. In the lobby the field `código de acesso` is visible; entering a wrong code and choosing `jogar agora` shows `Código de acesso inválido`, the correct code joins. Not exercised in the first seed run.
- **Proof.** The origin transcript and, for the code path, the lobby alert text plus `/status` showing `codeRequired: true`.

## Gotchas

- Origin matching is exact (scheme, host and port); `localhost` and `127.0.0.1` are different origins. `up.sh` allows both on the client port.
- Do not weaken the check to make a recipe pass; a connection without an `Origin` header is also refused.
