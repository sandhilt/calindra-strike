# Elimination rounds and leads

Start the isolated server with `GAME_MODES=lms GAME_MAPS=forja MATCH_SECONDS=180 WARMUP_MIN_PLAYERS=2` and run the doctor. Join with two players or dev bots. Verify `elimination.kind` stays `waiting` with `startsAt` for the 30-second join window. Have a third player join and confirm readiness at 20 seconds. Check that all three are alive when round one starts at 30 seconds. With a WebGL client, check the join countdown in the match status. In `/status`, check `elimination.kind`, `number` and `alive`. After an elimination, check that the alive count stays down even after the normal respawn time. When one player remains, check that the round pauses, reports that player's ID and restarts after four seconds. With a WebGL client, verify the countdown beside the match timer (warning colour in the final ten seconds and hidden during pauses), and the lead banner and feed at the first outright score.

Restart with `GAME_MODES=gincana`. Check that eliminating one player leaves their surviving team in play and that eliminating the last player on that side awards exactly one round to the opposing team. Check the team alive counts in `/status` and that dead players follow only teammates.

For a wire-level check, retain the snapshots and `lead` events. Verify that two successive lead events are at least 45 seconds apart in one match. Clean up with `down.sh`.
