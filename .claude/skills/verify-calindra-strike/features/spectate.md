# Spectating (`spectate`)

Use the isolated sandbox and doctor described in the skill. Start with TDM,
no bots, and no players. Use the installed `ws` client for an Origin header
(Node's global WebSocket does not support custom headers):

```js
import WebSocket from 'ws';
import { PROTOCOL_VERSION, WEAPON } from './shared/src/index.ts';
const ws = new WebSocket('ws://127.0.0.1:7450/ws', {
  headers: { Origin: 'http://127.0.0.1:5273' },
});
ws.on('open', () => ws.send(JSON.stringify({
  t: 'hello', v: PROTOCOL_VERSION, name: 'Watcher', color: 0,
  primary: WEAPON.RIFLE, code: '', spectate: true,
})));
ws.on('message', data => console.log(data.toString()));
// After welcome, optionally choose before the 15-second timeout:
// ws.send(JSON.stringify({ t: 'watch', team: 1 }));
// Close when finished: ws.close();
```

Capture welcome.spectator choosing with pickEndsAt, then spectate watching on
choice or timeout. Send watch again with the other team and confirm the switch
is accepted, including after the initial 15-second deadline. Only the first pick
is timed; later switches through the Esc menu are free. Join ordinary players to make unequal teams and confirm the
timeout selects the smaller side. Confirm snapshots have me:null and ack:-1,
and match/score/roster messages exclude the spectator ID from player data.
/status must still count zero players with only spectators, and stay in warmup.
At a full player limit a watcher can still join; watcher 17 is rejected.

Send in/loadout/vote/team/chat as a watcher: no gameplay, votes or chat should
result; repeated forbidden actions trigger the existing strike policy. Ping and
watch remain available. Verify player chat is received by watchers. Close the
socket and confirm a replacement watcher can use its slot.

Repeat with FFA: welcome is watching team -1, watch is ignored. Rotate to TDM:
a new choosing deadline appears. Run server/test/spectator.test.ts for deterministic
coverage, including private event isolation and adapter dispatch with a fake socket.
Capture raw messages, /status and server logs under artifacts/spectate/.

The 3D follow camera, Esc team menu and HUD require a WebGL-capable browser and
are not proved by this server recipe.
