# Shopping debug defusion

Run Shopping Sul Rio in debug defusion mode. Use a browser with WebGL for the visual checks.

- Find the laptop and its crate at the attacking team’s Mirante base. Take the laptop and head to the ground-floor fountain by the escalators or glass lift.
- While carrying the laptop, check that the HUD site marker sits above the fountain column and that the red ring is visible over the basin rim.
- Jump into the basin and plant while standing in shallow water. Check that the desk sits where the plant finished and that the planter steps clear of the desk and fountain solids.
- Defuse and confirm that the laptop returns to the new attacking team’s Mirante base and the site stays at the fountain.
- For a server-only check, run `node --test server/test/defuse.test.ts server/test/bot-defuse.test.ts server/test/nav.test.ts`. The tests cover the basin plant, desk exit, defuse, respawn keep-out and live bots.
