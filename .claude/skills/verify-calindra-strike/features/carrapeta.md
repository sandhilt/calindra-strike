# Carrapeta Dourada

Start the isolated server with `GAME_MODES=carrapeta MATCH_SECONDS=120 WARMUP_MIN_PLAYERS=2` and run the doctor. Join two players through the local MCP launcher configured for that server. A frenzy is drawn randomly once per match, so observe a later match if the current one has no frenzy.

- Read `get_state` for both players after live starts. Confirm that they agree on the holder and only the holder reports `youHoldIt`. Check that the holder gains points outside the lift and can reload a six-round Azeitadora with infinite reserve.
- Set the challenger to `hunt`. When the holder dies, check the dropped position and redraw countdown. Verify that walking over the drop transfers possession. In a separate run, leave the drop alone and watch for its reassignment when the timer expires.
- During Batata Quente, check its countdown, the holder’s three-round magazine and the return to normal capacity when the event ends. With three players, confirm the two challengers cannot damage each other while the event is active.
- Capture the resulting states and the podium points. In a WebGL-capable browser, inspect the golden aura, possession banner and loss message.
