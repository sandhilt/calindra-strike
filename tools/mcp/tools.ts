import { CHAT_MAX_LEN, WEAPON, type WeaponId } from '../../shared/src/index.ts';
import { result, failure, type McpTool } from './jsonrpc.ts';
import type { GameSession } from './session.ts';
import { WEAPON_SLOT_REQUEST, type WeaponSlot } from './actions.ts';
const isWeaponSlot = (slot: string): slot is WeaponSlot => Object.hasOwn(WEAPON_SLOT_REQUEST, slot);
type Args = Record<string, unknown>;
const number = (a: Args, k: string, min = -Infinity, max = Infinity, integer = false): number => {
  const v = a[k];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v)))
    throw new Error(`Invalid ${k}`);
  return v;
};
const boolean = (a: Args, k: string): boolean => {
  const v = a[k];
  if (typeof v !== 'boolean') throw new Error(`Invalid ${k}`);
  return v;
};
const string = (a: Args, k: string, max: number, fallback?: string): string => {
  const v = a[k] === undefined ? fallback : a[k];
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(`Invalid ${k}`);
  return v.trim();
};
const primary = (a: Args): WeaponId => {
  const p = a.primary === undefined ? 'rifle' : a.primary;
  if (p === 'rifle') return WEAPON.RIFLE;
  if (p === 'smg') return WEAPON.SMG;
  if (p === 'shotgun') return WEAPON.SHOTGUN;
  throw new Error('Invalid primary');
};
const primarySchema = { type: 'string', enum: ['rifle', 'smg', 'shotgun'] };
interface Definition {
  name: string;
  description: string;
  properties: Record<string, object>;
  required?: string[];
  run: (s: GameSession, a: Args, code: string) => unknown;
}
export const toolDefinitions: Definition[] = [
  {
    name: 'join',
    description:
      'Join the game; defaults to agent, rifle and color 0. Repeated joins return your current state.',
    properties: {
      name: { type: 'string', maxLength: 16 },
      color: { type: 'integer', minimum: 0, maximum: 11 },
      primary: primarySchema,
      code: { type: 'string', maxLength: 64 },
    },
    run: (s, a, code) => {
      const c = a.code === undefined ? code : a.code;
      if (typeof c !== 'string' || c.length > 64) throw new Error('Invalid code');
      return s.join({
        name: string(a, 'name', 16, 'agent'),
        color: a.color === undefined ? 0 : number(a, 'color', 0, 11, true),
        primary: primary(a),
        code: c,
      });
    },
  },
  {
    name: 'leave',
    description: 'Disconnect and stop all inputs.',
    properties: {},
    run: (s) => {
      s.close();
      return { phase: 'closed' };
    },
  },
  {
    name: 'get_state',
    description:
      'Read perceived players, lastSeen positions, scores, flags (state, carrier, position, distance/bearing) and recent events/chat including flag actions. Bearing is degrees relative to your facing, positive right. Perception reports sight, sound or team; omniscient mode is explicitly labeled. Reading drains events/chat.',
    properties: {},
    run: (s) => s.getState(),
  },
  {
    name: 'move_to',
    description: 'Keep navigating to x,z in game units until another intent is set. Unreachable goals fail.',
    properties: { x: { type: 'number' }, z: { type: 'number' } },
    required: ['x', 'z'],
    run: (s, a) => s.setIntent({ kind: 'moveTo', x: number(a, 'x'), z: number(a, 'z') }),
  },
  {
    name: 'attack',
    description: 'Attack a currently perceived enemy. Losing perception ends the intent; use lastSeen and move_to to search.',
    properties: { target_id: { type: 'integer', minimum: 0 } },
    required: ['target_id'],
    run: (s, a) => s.setIntent({ kind: 'attack', targetId: number(a, 'target_id', 0, 2 ** 31, true) }),
  },
  {
    name: 'hunt',
    description: 'Hunt perceived enemies; pursue CTF flags by team role, otherwise roam toward airdrops or random nodes until an enemy is perceived. Persists across respawns.',
    properties: {},
    run: (s) => s.setIntent({ kind: 'hunt' }),
  },
  {
    name: 'stop',
    description: 'Stop moving and firing while remaining connected.',
    properties: {},
    run: (s) => s.setIntent({ kind: 'idle' }),
  },
  {
    name: 'wait',
    description: 'Wait 100 to 5000 ms while the pilot keeps playing, then read state and drain events/chat.',
    properties: { ms: { type: 'number' } },
    required: ['ms'],
    run: async (s, a) => {
      s.requirePlaying();
      const ms = Math.max(100, Math.min(5000, number(a, 'ms')));
      await new Promise((resolve) => setTimeout(resolve, ms));
      return s.getState();
    },
  },
  {
    name: 'jump',
    description: 'Jump once. Only works on the ground. Use it for ledges and to get unstuck.',
    properties: {},
    run: (s) => s.jump(),
  },
  {
    name: 'crouch',
    description: 'Crouch (on: true) or stand (on: false). Stays set, also while idle, until changed or you respawn. Crouching is slow but tightens spread and shrinks the hitbox.',
    properties: { on: { type: 'boolean' } },
    required: ['on'],
    run: (s, a) => s.setCrouch(boolean(a, 'on')),
  },
  {
    name: 'zoom',
    description: 'Set the scope level: 0 off, 1 or 2 zoomed. Only for a weapon with a scope (the AWP). Once set it replaces the pilot\'s automatic scoping until you respawn. The scope drops during the AWP bolt cycle and returns by itself.',
    properties: { level: { type: 'integer', minimum: 0, maximum: 2 } },
    required: ['level'],
    run: (s, a) => s.setZoom(number(a, 'level', 0, 2, true)),
  },
  {
    name: 'walk',
    description: 'Walk (Shift) while on; stays set until changed or you respawn.',
    properties: { on: { type: 'boolean' } },
    required: ['on'],
    run: (s, a) => s.walk(boolean(a, 'on')),
  },
  {
    name: 'reload',
    description: 'Reload once (R). Requires a weapon that can reload.',
    properties: {},
    run: (s) => s.reload(),
  },
  {
    name: 'switch_weapon',
    description: 'Switch weapon once: primary (1), pistol (2), hammer (3) or last (Q).',
    properties: { slot: { type: 'string', enum: Object.keys(WEAPON_SLOT_REQUEST) } },
    required: ['slot'],
    run: (s, a) => {
      const slot = string(a, 'slot', Infinity);
      if (!isWeaponSlot(slot)) throw new Error('Invalid slot');
      return s.switchWeapon(slot);
    },
  },
  {
    name: 'choose_loadout',
    description: 'Choose rifle, smg or shotgun for the next spawn.',
    properties: { primary: primarySchema },
    required: ['primary'],
    run: (s, a) => {
      s.send({ t: 'loadout', primary: primary(a) });
      return 'Loadout requested';
    },
  },
  {
    name: 'say',
    description: `Send a chat message (up to ${CHAT_MAX_LEN} characters).`,
    properties: { text: { type: 'string', minLength: 1, maxLength: CHAT_MAX_LEN } },
    required: ['text'],
    run: (s, a) => {
      s.send({ t: 'chat', text: string(a, 'text', CHAT_MAX_LEN) });
      return 'Chat sent';
    },
  },
  {
    name: 'vote',
    description: 'Vote for a next-match option index during podium.',
    properties: { option: { type: 'integer', minimum: 0, maximum: 7 } },
    required: ['option'],
    run: (s, a) => {
      s.send({ t: 'vote', option: number(a, 'option', 0, 7, true) });
      return 'Vote requested';
    },
  },
  {
    name: 'switch_team',
    description: 'Request team 0 or 1 in team deathmatch.',
    properties: { team: { type: 'integer', minimum: 0, maximum: 1 } },
    required: ['team'],
    run: (s, a) => {
      s.send({ t: 'team', team: number(a, 'team', 0, 1, true) });
      return 'Team requested';
    },
  },
];
export function createTools(session: GameSession, code = ''): McpTool[] {
  return toolDefinitions.map((d) => ({
    name: d.name,
    description: d.description,
    inputSchema: {
      type: 'object',
      properties: d.properties,
      required: d.required ?? [],
      additionalProperties: false,
    },
    async call(raw: unknown) {
      try {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
          throw new Error('Arguments must be an object');
        const a = raw as Args;
        if (
          Object.keys(a).some((k) => !Object.hasOwn(d.properties, k)) ||
          d.required?.some((k) => !Object.hasOwn(a, k))
        )
          throw new Error('Unexpected or missing argument');
        return result(await d.run(session, a, code));
      } catch (e) {
        return failure(e);
      }
    },
  }));
}
