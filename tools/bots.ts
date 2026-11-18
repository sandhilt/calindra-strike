/**
 * Dev-only load/behaviour test: spawns simple bots that strafe around and shoot
 * at the nearest player, or play the objective in debug defusion. Usage:
 *   node tools/bots.ts [count=3] [ws://127.0.0.1:7350/ws] [origin=http://localhost:5173] [passive]
 * `passive` bots walk up to the nearest player and strafe in front of them without shooting
 * (handy for screenshots and for testing hit registration).
 */
import { BTN, PROTOCOL_VERSION, newBotChatMemory, pickBotChat, TICK_MS, WEAPON, encodeCmd, type MatchInfo, type RosterEntry, type ServerMsg } from '../shared/src/index.ts';
import { parseArgs } from 'node:util';
import { DefuseDriver } from './defuse-driver.ts';
import { reactionTrigger } from './bot-reaction.ts';

const { positionals } = parseArgs({ allowPositionals: true });
const count = Number(positionals[0] ?? 3);
const url = positionals[1] ?? 'ws://127.0.0.1:7350/ws';
const origin = positionals[2] ?? 'http://localhost:5173';
const passive = positionals[3] === 'passive';
const NAMES = ['Brokkr', 'Sindri', 'Freya', 'Loki', 'Tyr', 'Skadi', 'Odin', 'Heimdall'];

// Shared by every dev bot in this process, like the server's room-wide gate.
let lastAnyChatAt = -Infinity;

function bot(i: number): void {
  const chatMemory = newBotChatMemory();
  const ws = new WebSocket(url, { headers: { Origin: origin } });
  let id = -1;
  let me: number[] | null = null;
  let others: number[][] = [];
  let seq = 0;
  let t = 0;
  let serverTime = 0;
  let mode = 'ffa';
  let map = -1;
  let snap: Extract<ServerMsg, { t: 'snap' }> | null = null;
  let defuse = new DefuseDriver();
  const setMatch = (match: MatchInfo) => {
    if (mode !== match.mode || map !== match.map) {
      snap = null;
      defuse = new DefuseDriver();
    }
    mode = match.mode;
    map = match.map;
  };
  const teams = new Map<number, number>();
  const setRoster = (r: RosterEntry[]) => {
    teams.clear();
    for (const [pid, , , team] of r) teams.set(pid, team);
  };
  ws.addEventListener('open', () =>
    ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: `bot ${NAMES[i % NAMES.length]}`, color: (i * 5) % 12, primary: [WEAPON.RIFLE, WEAPON.SMG, WEAPON.SHOTGUN][i % 3] })),
  );
  ws.addEventListener('message', (e) => {
    const m: ServerMsg = JSON.parse(String(e.data));
    if (m.t === 'welcome') {
      id = m.id;
      setMatch(m.match);
      setRoster(m.roster);
    }
    if (m.t === 'roster') setRoster(m.roster);
    if (m.t === 'match') setMatch(m.match);
    if (m.t === 'snap') {
      snap = m;
      me = m.me;
      serverTime = m.time;
      others = m.ps.filter((p: number[]) => p[0] !== id && !(mode !== 'ffa' && teams.get(p[0]) === teams.get(id)));
    }
    if (m.t === 'ev') {
      for (const ev of m.e) {
        const trigger = reactionTrigger(ev, id);
        if (!trigger) continue;
        const now = performance.now();
        const text = pickBotChat(trigger, chatMemory, lastAnyChatAt, now, Math.random(), Math.random());
        if (!text) continue;
        chatMemory.lastAt = lastAnyChatAt = now;
        chatMemory.lastLine = text;
        ws.send(JSON.stringify({ t: 'chat', text }));
        break;
      }
    }
    if (m.t === 'reject') console.log('rejected', m.reason);
  });
  ws.addEventListener('close', (e) => console.log(`bot ${i} closed`, e.code, e.reason));
  const timer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN || id < 0) return;
    t++;
    const cmds = [];
    const interp = Math.max(0, serverTime - 100);
    if (mode === 'defuse' && !passive) {
      if (!snap) return;
      const input = defuse.drive(snap, map, id, teams, t);
      for (let k = 0; k < 2; k++) cmds.push(encodeCmd({ ...input, seq: ++seq, interp }));
      ws.send(JSON.stringify({ t: 'in', c: cmds }));
      return;
    }
    for (let k = 0; k < 2; k++) {
      let yaw = (t * 0.01 + i) % (Math.PI * 2);
      let pitch = 0;
      let buttons: number = (Math.floor(t / 40) + i) % 2 ? BTN.LEFT : BTN.RIGHT;
      if (t % 120 === 0) buttons |= BTN.JUMP;
      if (me) {
        const [x, y, z] = me;
        let best: number[] | null = null;
        let bd = 1e9;
        for (const o of others) {
          const dd = Math.hypot(o[1] - x, o[3] - z);
          if (dd < bd) {
            bd = dd;
            best = o;
          }
        }
        if (best && bd < (passive ? 4000 : 1500)) {
          const dx = best[1] - x;
          const dz = best[3] - z;
          const dy = best[2] + 56 - (y + 64);
          yaw = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 0.06;
          pitch = Math.atan2(dy, Math.hypot(dx, dz)) + (Math.random() - 0.5) * 0.04;
          if (passive) {
            // close in to ~320 units, then strafe slowly in view
            buttons = bd > 320 ? BTN.FWD : (Math.floor(t / 70) + i) % 2 ? BTN.LEFT | BTN.WALK : BTN.RIGHT | BTN.WALK;
          } else if (t % 50 < 20) buttons |= BTN.ATTACK;
        } else buttons |= BTN.FWD;
      }
      cmds.push(encodeCmd({ seq: ++seq, buttons, yaw, pitch, weapon: 0, interp }));
    }
    ws.send(JSON.stringify({ t: 'in', c: cmds }));
  }, TICK_MS * 2);
  ws.addEventListener('close', () => clearInterval(timer));
}

for (let i = 0; i < count; i++) setTimeout(() => bot(i), i * 300);
