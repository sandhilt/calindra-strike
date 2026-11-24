/**
 * Dev-only load/behaviour test: spawns simple bots that strafe around and shoot
 * at the nearest player, or play the objective in debug defusion, capture the flag and Carrapeta Dourada. Usage:
 *   node tools/bots.ts [count=3] [ws://127.0.0.1:7350/ws] [origin=http://localhost:5173] [passive]
 * `passive` bots walk up to the nearest player and strafe in front of them without shooting
 * (handy for screenshots and for testing hit registration).
 * They aim like the server bots at BOT_SKILL (0-100, default 50), read from the environment or `.env`.
 */
import {
  BTN, PROTOCOL_VERSION, TICK_MS, WEAPON, encodeCmd, fillBotChat, newBotChatMemory, newTalkMemory, isTeamMode, pickBotChat, pickBotRadio, recordTalk,
  type BotRadioTrigger, type MatchInfo, type RosterEntry, type ServerMsg,
} from '../shared/src/index.ts';
import { parseArgs } from 'node:util';
import { botSkill } from '../server/src/bot.ts';
import { BotDriver } from './bot-driver.ts';
import { brainFor } from './brains.ts';
import { DeathStreaks, fellLow, reactionsTo } from './bot-reaction.ts';

const { positionals } = parseArgs({ allowPositionals: true });
const count = Number(positionals[0] ?? 3);
const url = positionals[1] ?? 'ws://127.0.0.1:7350/ws';
const origin = positionals[2] ?? 'http://localhost:5173';
const passive = positionals[3] === 'passive';
const skillText = process.env.BOT_SKILL?.trim() || '50';
const skill = Number(skillText);
if (!/^\d+$/.test(skillText) || skill > 100) throw new Error(`BOT_SKILL must be an integer 0-100, got "${skillText}"`);
const NAMES = ['Brokkr', 'Sindri', 'Freya', 'Loki', 'Tyr', 'Skadi', 'Odin', 'Heimdall'];

// Shared by every dev bot in this process, like the server's room-wide gate.
let lastAnyChatAt = -Infinity;
let lastAnyRadioAt = -Infinity;

function bot(i: number): void {
  const chatMemory = newBotChatMemory();
  const radioMemory = newTalkMemory<number>();
  const streaks = new DeathStreaks();
  const names = new Map<number, string>();
  let health = 100;
  let phase = '';
  const ws = new WebSocket(url, { headers: { Origin: origin } });
  let id = -1;
  let me: number[] | null = null;
  let others: number[][] = [];
  let seq = 0;
  let t = 0;
  let serverTime = 0;
  let mode: MatchInfo['mode'] = 'ffa';
  let map = -1;
  let snap: Extract<ServerMsg, { t: 'snap' }> | null = null;
  let driver: BotDriver | null = null;
  const setMatch = (match: MatchInfo) => {
    if (mode !== match.mode || map !== match.map) {
      snap = null;
      const brain = brainFor(match.mode);
      driver = brain ? new BotDriver(brain, botSkill(skill / 100, Math.random)) : null;
    }
    mode = match.mode;
    map = match.map;
  };
  const teams = new Map<number, number>();
  const setRoster = (r: RosterEntry[]) => {
    teams.clear();
    names.clear();
    for (const [pid, name, , team] of r) {
      teams.set(pid, team);
      names.set(pid, name);
    }
  };
  /** The radio goes through the same cooldowns as the server bots: one call per bot every 45 s, one per room every 12 s. */
  const callRadio = (trigger: BotRadioTrigger) => {
    const now = performance.now();
    const line = pickBotRadio(trigger, radioMemory, lastAnyRadioAt, now, Math.random(), Math.random());
    if (line === null) return;
    recordTalk(radioMemory, line, now);
    lastAnyRadioAt = now;
    ws.send(JSON.stringify({ t: 'radio', line }));
  };
  ws.addEventListener('open', () =>
    ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: `bot ${NAMES[i % NAMES.length]}`, color: (i * 5) % 12, primary: [WEAPON.RIFLE, WEAPON.SMG, WEAPON.SHOTGUN][i % 3] })),
  );
  ws.addEventListener('message', (e) => {
    const m: ServerMsg = JSON.parse(String(e.data));
    if (m.t === 'welcome') {
      ws.send(JSON.stringify({ t: 'ready' }));
      id = m.id;
      setMatch(m.match);
      setRoster(m.roster);
    }
    if (m.t === 'readiness') ws.send(JSON.stringify({ t: 'ready' }));
    if (m.t === 'roster') setRoster(m.roster);
    if (m.t === 'match') {
      setMatch(m.match);
      if (m.match.phase === 'live' && phase !== 'live') {
        streaks.clear();
        callRadio('calindra');
        callRadio('roundStart');
      }
      phase = m.match.phase;
    }
    if (m.t === 'snap') {
      snap = m;
      me = m.me;
      serverTime = m.time;
      const hp = m.me?.[7];
      if (hp !== undefined) {
        if (fellLow(health, hp)) callRadio('hurt');
        health = hp;
      }
      if (!driver || passive) {
        const teamMode = isTeamMode(mode);
        others = m.ps.filter(p => p[0] !== id && (!teamMode || teams.get(p[0]) !== teams.get(id)));
      }
    }
    if (m.t === 'ev') {
      let spoke = false;
      for (const ev of m.e) {
        for (const reaction of reactionsTo(ev, { me: id, names, teams }, streaks)) {
          if (reaction.channel === 'radio') {
            callRadio(reaction.trigger);
            continue;
          }
          if (spoke) continue;
          const now = performance.now();
          const line = pickBotChat(reaction.trigger, chatMemory, lastAnyChatAt, now, Math.random(), Math.random());
          if (!line) continue;
          recordTalk(chatMemory, line, now);
          lastAnyChatAt = now;
          spoke = true;
          ws.send(JSON.stringify({ t: 'chat', text: fillBotChat(line, reaction.about ?? '') }));
        }
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
    if (driver && !passive) {
      if (!snap) return;
      const input = driver.drive(snap, map, id, teams, t, mode);
      for (let k = 0; k < 2; k++) {
        const cmd = { ...input, seq: ++seq, interp };
        driver.sent(cmd);
        cmds.push(encodeCmd(cmd));
      }
      if (driver.takeSpotted()) callRadio('enemySpotted');
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
