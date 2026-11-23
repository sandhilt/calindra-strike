# Shopping debug defusion

Run Shopping Sul Rio in debug defusion mode. To verify the full route in a browser with WebGL, start in warmup or allow at least 60 seconds to plant.

- While carrying the laptop through the atrium, check that the HUD site marker points to the Mirante. Walk up by the escalators and check that the red site ring lies on the third-floor surface.
- At the opposite end of the mall, check that the laptop and its crate sit on the Mirante. Take the laptop, cross to the other base and plant. Check that the laptop and desk sit where the plant finished. Defuse and confirm the bases swap roles.
- Try the glass lift and the escalator routes and judge the climb and the time allowed for a live round.
- For a server-only check, run `node --test server/test/bot-defuse.test.ts server/test/nav.test.ts`. The tests cover ground-to-Mirante paths and a live bot match with plants and defuses upstairs.
