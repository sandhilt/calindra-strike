import { CHAT_MAX_LEN, WEAPON, type WeaponId } from '../../shared/src/index.ts';
import { result, failure, type McpTool } from './jsonrpc.ts';
import type { GameSession } from './session.ts';
type Args = Record<string, unknown>;
const number = (a: Args, k: string, min = -Infinity, max = Infinity, integer = false): number => {
  const v = a[k];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v)))
    throw new Error(`Invalid ${k}`);
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
      'Read authoritative global positions, scores and recent events/chat. Bearing is degrees relative to your facing, positive right. No visibility is implied. Reading drains events/chat.',
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
    description: 'Pursue and shoot a living enemy id. Missing/dead targets stop the intent.',
    properties: { target_id: { type: 'integer', minimum: 0 } },
    required: ['target_id'],
    run: (s, a) => s.setIntent({ kind: 'attack', targetId: number(a, 'target_id', 0, 2 ** 31, true) }),
  },
  {
    name: 'hunt',
    description: 'Continuously pursue and shoot the nearest living enemy; persists across respawns.',
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
