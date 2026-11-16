# Match flow

A match cycles warmup, live and podium, then the next map and mode in the rotation starts. With the sandbox defaults the whole loop takes about 25 s.

## Sub-features

- `flow-start` warmup becomes live once `WARMUP_MIN_PLAYERS` players are in.
- `flow-end` the match ends after `MATCH_SECONDS` and shows the podium for `PODIUM_SECONDS`.
- `flow-rotate` the next match uses a different map and mode than the last.

## How to get to it (user POV)

- Join a match from the lobby and wait, or let a bot hold the slot while observing.

## Driving it with scripts and /status

Preconditions: baseline sandbox, `players: 0`.

- **Start a player.** Run `scripts/bots.sh 1`. One bot joins; the server log shows `join` and `/status` goes `warmup` then `live`.
- **Watch phases.** Run `scripts/watch-phase.sh 35 | tee $VERIFY_DIR/artifacts/match-flow/phases.txt`. Observed output:
  `phase=live map=Escritório mode=ffa` at t=0, `phase=podium` at about t+20 s, `phase=live map=Forja mode=ffa` about 2 s later. The map or mode (or both) differ between consecutive matches.
- **Proof.** The `phases.txt` transcript with timestamps (live to podium roughly `MATCH_SECONDS`, podium roughly `PODIUM_SECONDS`) and a changed map or mode.
- **Cleanup.** `scripts/down.sh` stops the bot.

## Gotchas

- With 0 players the phase stays `warmup` and nothing advances; a closed browser tab removes its player and the match resets to warmup.
- The podium scene itself and the final ranking panel are 3D/HUD and cannot be seen in the MCP browser (no WebGL). Only the phase transition is verified here.
- Bots are `BOT_FILL`-independent here: `tools/bots.ts` connects as normal clients, so they count as `players`, not `bots`, in `/status`.
