# Map speakers

Use an isolated match with a WebGL-capable browser that can play audio. Put an Ogg track you own at `client/public/music/forja.ogg` for the Forja check, and start a match on that map.

1. Open Network and approach a speaker inside a warehouse. Check that `/music/forja.ogg` loads once and that the track becomes audible from the speaker.
2. In the pause menu, set **música** to zero and back up while the speaker is in range. The music should mute and return at its current position. Master **volume** should also affect music.
3. Move out of range and approach a second speaker. The volume should fade with distance, and the second speaker should use the cached track.
4. Remove the temporary asset and reload the page. Approach a speaker twice in the new session. The missing request should occur once and the speaker should stay silent.

Save the request log with the test evidence. The MCP browser cannot confirm in-game rendering or audible playback.
