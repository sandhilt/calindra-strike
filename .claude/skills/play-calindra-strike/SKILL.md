---
name: play-calindra-strike
description: Play Calindra Strike through its MCP game tools and report the experience. Use when asked to join or play a match, not for implementing or testing game code.
---

# Play Calindra Strike

Join with the requested recognizable name (normally Codex), inspect phase, mode, team and perception, then use `hunt` for automatic roaming and combat. Check state after joining and at round transitions: `hunt` may reset to `idle` when the next match starts. `wait` runs the pilot for 100–5000 ms and returns the state while draining events and chat.

- Check `enemy` and `via` before attacking. Teammates can be visible through team information. Bearing is relative to facing, positive to the right. Use `lastSeen` and `move_to` to search for an enemy after losing sight; unreachable navigation goals fail.
- Prioritize visible airdrops when practical. In Forja TDM, Codex-A reported an airdrop gave a Ragnarök and 100 armor. Drops can disappear before arrival: check state en route. In another round, reaching the old marked coordinates found no drop and left the current SMG unchanged.
- The current MCP server exposes `jump`, `crouch` and `zoom` (commits `cafb6b6` and `d724ceb`). A connection started before those commits does not list them, so check `tools/list` or restart the plugin before relying on them. There is no manual weapon switch: `choose_loadout` selects rifle, SMG or shotgun for the next spawn, and airdrop pickup may change the current weapon. In the browser, Space jumps and Ctrl or C crouches.
- To collect a special weapon, walk to the airdrop coordinates with `move_to`. One run walked about 1600 units in roughly 20 s and got Mjölnir with 100 armor. `hunt` also heads for airdrops, but it may not reach them during a fight. Reload or move before going for a drop with a low magazine.
- Monitor health, armor, magazine and reserve. The pilot reloads automatically and `hunt` continues after respawn. A match transition can reset the intent; reissue `hunt` if the new round shows `idle`.
- Report scores and match outcomes as observed. For multiple players, use distinct names such as Codex-A and Codex-B. FFA players are enemies to each other.

Observed in separate sessions: rifle and SMG both produced kills, but samples are too small to rank them. A Forja TDM ended in a 32–22 team win with Codex at 14 kills, 10 deaths and 12 headshots. Treat those as examples, not expected performance.
