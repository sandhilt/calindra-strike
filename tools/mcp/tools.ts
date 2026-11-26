import { CHAT_MAX_LEN, LUNCH_USE_RADIUS_UNITS, PRONE_SWITCH_TICKS, SLIDE_MIN_SPEED, SLIDE_STAMINA_COST, SLIDE_TICKS, STAMINA_MAX, STAMINA_RESUME, TICK_MS, RADIO_MENUS, RADIO_MENU_IDS, WEAPON, radioLineAt, radioMenuById, weaponDef, type WeaponId } from '../../shared/src/index.ts';
import { result, failure, type McpTool } from './jsonrpc.ts';
import type { GameSession } from './session.ts';
import { LEAN_SIDES, WEAPON_SLOT_REQUEST, type LeanSide, type WeaponSlot } from './actions.ts';
const isLeanSide = (side: unknown): side is LeanSide => LEAN_SIDES.some((s) => s === side);
const isWeaponSlot = (slot: string): slot is WeaponSlot => Object.hasOwn(WEAPON_SLOT_REQUEST, slot);
const HAMMER = weaponDef(WEAPON.HAMMER);
const HEAVY_SWING = HAMMER.heavy ?? { damage: HAMMER.damage, ticks: HAMMER.fireTicks };
const seconds = (ticks: number): number => Math.round((ticks * TICK_MS) / 10) / 100;
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
      'Read your own stance (you.stance stand, crouch or prone; you.ducked is true for both low stances), sprinting, sliding, stamina (0 to 1; at 0 you are winded until it refills) winded (the meter emptied; no sprint until it refills) and lean (-1 left to 1 right; you set them with the sprint, slide, lean and prone tools, you.actions echoes what you asked for), you.aiming (effective aim down sights), you.zoom (effective 0/1 for ADS or 0–2 for AWP), you.maxZoom (1 for ADS, 2 for AWP, 0 for hammer), timeOfDay (the light of the map: phase day, afternoon or night, the phase it is blending into and how far, 0 to 1; a look only, sight and sound do not change), scene (crosshair facing, visible cover, known doors/stairs and landmarks, nearby sprays), perceived players, lastSeen positions, scores, debug defusion bomb (role, home and site with coordinates and floor names, carrier/defuser, Black Friday flag, fuse, solid stand, timer and progress), flags (state, carrier, position, distance/bearing), hora de almoçar (role and rules, seconds left, seated count, each colleague with state, leader, distance/bearing and whether it is in USE reach, restaurants nearest first), you.floor (the named floor you stand on, null on one-level maps), airdrops (weapon name and whether the crate has landed), lifts (glass lifts nearest first: floors served, whether you are riding, seconds to the top, how to ride), supplies (supply stands nearest first: floor, ready or seconds until they refill, inReach, youNeedIt) Carrapeta Dourada (holder, hold timer holdSecondsLeft, dropped position and reroll timer, frenzy timer and your points), your magazine capacity, halved ammunition and infinite reserve, and recent events/chat including flag, bomb, lunch, Carrapeta, frenzy, blasts and supply actions, and sounds: what you heard since the last read (shot, impact with its material and surface, hurt), each with distance, bearing, intensity 0 to 1 and loudness (loud, medium, faint), loudest first; quieter than 0.08 is not reported. Bearing is degrees relative to your facing, positive right. Perception reports sight, sound or team; omniscient mode is explicitly labeled. Reading drains events/chat.',
    properties: {},
    run: (s) => s.getState(),
  },
  {
    name: 'move_to',
    description: 'Keep navigating to x,z in game units until another intent is set. Unreachable goals fail. y picks the floor on a multi-floor map (floor heights in get_state lifts.floors and you.floor; default: the height you stand at); the pilot uses stairs, escalators and the glass lift by itself, so move_to a point on another floor to change floor.',
    properties: { x: { type: 'number' }, z: { type: 'number' }, y: { type: 'number' } },
    required: ['x', 'z'],
    run: (s, a) => s.setIntent({ kind: 'moveTo', x: number(a, 'x'), z: number(a, 'z'), ...(a.y === undefined ? {} : { y: number(a, 'y') }) }),
  },
  {
    name: 'attack',
    description: 'Attack a currently perceived enemy. Losing perception ends the intent; use lastSeen and move_to to search.',
    properties: { target_id: { type: 'integer', minimum: 0 } },
    required: ['target_id'],
    run: (s, a) => s.setIntent({ kind: 'attack', targetId: number(a, 'target_id', 0, 2 ** 31, true) }),
  },
  {
    name: 'aim',
    description:
      'Free aim. Hold the crosshair on a world point (x, y, z; y is height, a floor point is y 0) or at an angle (yaw_deg as in get_state yawDeg, pitch_deg positive up), with the pilot standing still. Returns the angles and expect, the material and surface a shot from here would hit. Pair with fire to shoot walls, crates and the floor. Any move_to, attack, hunt or stop gives the view back to the pilot.',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      z: { type: 'number' },
      yaw_deg: { type: 'number' },
      pitch_deg: { type: 'number' },
    },
    run: (s, a) => {
      const point = a.x !== undefined || a.y !== undefined || a.z !== undefined;
      const angle = a.yaw_deg !== undefined || a.pitch_deg !== undefined;
      if (point === angle) throw new Error('Give either x, y and z, or yaw_deg and pitch_deg');
      return point
        ? s.aim({ x: number(a, 'x'), y: number(a, 'y'), z: number(a, 'z') })
        : s.aim({ yawDeg: number(a, 'yaw_deg'), pitchDeg: number(a, 'pitch_deg') });
    },
  },
  {
    name: 'fire',
    description:
      `Hold the trigger for ms (default 150, 50 to 5000) where the crosshair points; use aim first. Firing keeps effective ADS raised. A short press is one shot with a semi-automatic weapon, a hold is a burst with an automatic one. With the hammer in hand a plain fire is the light swing (the left mouse button) and heavy: true is the heavy swing (the right mouse button): ${HEAVY_SWING.damage} damage instead of ${HAMMER.damage}, one swing every ${seconds(HEAVY_SWING.ticks)} s instead of ${seconds(HAMMER.fireTicks)} s, same reach. heavy is rejected for any other weapon, and switching weapons cancels it. The pilot stays idle after aim or stop, so nothing else fires. Shots and their impacts then show up in get_state sounds (your own hammer swings make no sound there).`,
    properties: { ms: { type: 'number', minimum: 50, maximum: 5000 }, heavy: { type: 'boolean' } },
    run: (s, a) => s.fire(a.ms === undefined ? 150 : number(a, 'ms', 50, 5000), a.heavy === undefined ? false : boolean(a, 'heavy')),
  },
  {
    name: 'hunt',
    description: 'Hunt perceived enemies; pursue CTF flags, debug defusion objectives (pick up, plant and defuse with USE, laptop starts on the Mirante and plants at the ground-floor fountain in Shopping Sul Rio) and hora de almoçar by team role (attackers call colleagues with USE and lead them to a restaurant, defenders chase the leader), and Carrapeta Dourada (walk over the dropped objective or chase its perceived holder, respecting the combat rule: while someone holds it only the holder and whoever shoots them can hurt each other). Otherwise roam toward airdrops, shop and room interiors or random nodes until an enemy is perceived, and walk to a full supply stand (Shopping Sul Rio, Mirante) when hurt or low on ammunition, riding escalators and the glass lift. After taking damage, the pilot may draw the hammer and charge a nearby enemy with light swings. Persists across respawns.',
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
    name: 'use',
    description: `Hold USE while stationary to plant or defuse, or in hora de almoçar to call the waiting colleagues within ${LUNCH_USE_RADIUS_UNITS} units (attackers only). Objective use suppresses ADS until the hold ends. Defuse within reach of any side or corner of the solid desk. Defaults to until the objective changes, at most 10000 ms; returns planted, defused, following (the colleagues that now follow you) or interrupted with a reason.`,
    properties: { ms: { type: 'number', exclusiveMinimum: 0, maximum: 10000 } },
    run: (s, a) => s.use(a.ms === undefined ? undefined : number(a, 'ms', 1, 10000)),
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
    description: 'For pistol, rifle, SMG, shotgun, LMG and the Azeitadora, 1 holds aim down sights and 0 releases it. It slows movement, tightens spread and ends sprinting. Reload, deploy and objective use interrupt effective aim. The request resumes when those end and clears on a weapon switch, death, respawn or leave. Check you.aiming for effective aim and you.actions.zoom for the request. For AWP, 0 to 2 sets the CS scope level and overrides automatic scoping until respawn. The scope drops during the bolt cycle and returns by itself. The hammer rejects zoom: its right button is the heavy swing, use fire with heavy: true.',
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
    name: 'sprint',
    description: `Sprint (on: true) or stop (on: false). Stays set, also while idle, until changed or you respawn, but it only runs while you move forward (move_to, hunt or attack) standing on the ground: speed rises 35 percent and stamina (get_state you.stamina, 0 to 1) drains from full in about 5 s. At 0 you are winded (you.winded) and cannot sprint until it refills to ${STAMINA_RESUME / STAMINA_MAX}, about 6 s from empty to full. Walk (the walk tool wins over sprint), crouch, prone, moving backward, a jump, firing, held ADS (zoom 1 on an ADS weapon), a slide or being winded end the sprint, ending it delays your next shot by about ${Math.round(9 * TICK_MS)} ms, and starting it drops the scope. get_state you.sprinting shows it running. Returns the latched actions and blockedBy, the latched ones that stop the sprint now.`,
    properties: { on: { type: 'boolean' } },
    required: ['on'],
    run: (s, a) => s.sprint(boolean(a, 'on')),
  },
  {
    name: 'slide',
    description: `Slide once, to dive behind cover at speed: a push along your heading for up to ${Math.round(SLIDE_TICKS * TICK_MS)} ms, low and crouched, that costs ${SLIDE_STAMINA_COST / STAMINA_MAX} stamina. It only starts while you sprint on the ground at ${SLIDE_MIN_SPEED} units/s or more with enough stamina, so call sprint(true), run forward (hunt or move_to), wait until get_state you.sprinting is true, then slide. The tool presses crouch for one command, so a latched crouch (crouch on) hides the press: call crouch(false) first. Returns requested true when the last snapshot allows it, or requested false with the reason (not sprinting, too slow, low stamina, in the air, crouch latched); the request is dropped, not queued. Check get_state you.sliding afterwards. A jump, going prone or slowing under 120 units/s ends it. You cannot sprint or lean during a slide.`,
    properties: {},
    run: (s) => s.slide(),
  },
  {
    name: 'lean',
    description: 'Lean the head and gun left or right to peek around a corner, or off to straighten up. Stays set, also while idle, until changed or you respawn. The move eases in over a few ticks and shows in get_state you.lean (-1 left to 1 right). A lean shifts your eye and your head and body hitboxes by up to 18 units, and stops short of a wall beside you. The sim forces it to 0 while you sprint, slide, lie prone or are in the air, and it comes back by itself when that ends. Leaning does not change your aim or movement.',
    properties: { side: { type: 'string', enum: [...LEAN_SIDES] } },
    required: ['side'],
    run: (s, a) => {
      const side = string(a, 'side', Infinity);
      if (!isLeanSide(side)) throw new Error('Invalid side');
      return s.setLean(side);
    },
  },
  {
    name: 'prone',
    description: `Lie down (on: true) or get up (on: false), for low cover and a hitbox about 20 units tall that is hard to hit and steadier to shoot from. Stays set, also while idle, until changed or you respawn. Only works on the ground. Lying down or getting up locks your stance for ${Math.round(PRONE_SWITCH_TICKS * TICK_MS)} ms, a prone player moves at 15 percent speed, cannot jump, sprint, slide or lean, and stands up only where there is headroom. get_state you.stance shows prone when it took. Prone beats crouch if both are on.`,
    properties: { on: { type: 'boolean' } },
    required: ['on'],
    run: (s, a) => s.setProne(boolean(a, 'on')),
  },
  {
    name: 'reload',
    description: 'Reload once (R). Requires a weapon that can reload. Held ADS resumes when the reload ends.',
    properties: {},
    run: (s) => s.reload(),
  },
  {
    name: 'switch_weapon',
    description: 'Switch weapon once: primary (1), pistol (2), hammer (3) or last (Q). Switching clears the ADS request.',
    properties: { slot: { type: 'string', enum: Object.keys(WEAPON_SLOT_REQUEST) } },
    required: ['slot'],
    run: (s, a) => {
      const slot = string(a, 'slot', Infinity);
      if (!isWeaponSlot(slot)) throw new Error('Invalid slot');
      return s.switchWeapon(slot);
    },
  },
  {
    name: 'cycle_weapon',
    description: 'Step the mouse wheel once: next (wheel down) or previous (wheel up) through primary, pistol and hammer, wrapping around. Same effect as switch_weapon with the slot that comes next, without needing to know which weapon you hold. Switching clears the ADS request.',
    properties: { direction: { type: 'string', enum: ['next', 'previous'] } },
    required: ['direction'],
    run: (s, a) => {
      const direction = string(a, 'direction', Infinity);
      if (direction !== 'next' && direction !== 'previous') throw new Error('Invalid direction');
      return s.cycleWeapon(direction);
    },
  },
  {
    name: 'spray',
    description: 'Spray paint the surface in front of you (G), a decal with your colour, on a wall or the floor. You get 10 per spawn, 2 s apart, and the surface must be within 128 units ahead of your crosshair; the server drops it silently otherwise. get_state scene.facing.spray and scene.sprays show whether it landed.',
    properties: {},
    run: (s) => s.spray(),
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
    name: 'radio',
    description: `Send a prepared radio line (CS 1.6 style) to your team only, or to everyone in free-for-all; teammates see it in their feed and hear it, enemies never do. The server drops lines over its spam guard (defaults: 1.5 s between lines, 3 per 10 s) without telling you, so a success here does not mean it was delivered. Menus and lines: ${RADIO_MENUS.map((m) => `${m.id} (${m.keyLabel}): ${m.lines.map((l, i) => `${i + 1} ${l.text}`).join(' · ')}`).join('. ')}. Received lines appear in get_state chat with radio: true.`,
    properties: {
      menu: { type: 'string', enum: [...RADIO_MENU_IDS] },
      line: { type: 'integer', minimum: 1, maximum: 9 },
    },
    required: ['menu', 'line'],
    run: (s, a) => {
      const menu = radioMenuById(string(a, 'menu', Infinity));
      const line = menu && radioLineAt(menu.id, number(a, 'line', 1, 9, true));
      if (!line) throw new Error('Invalid radio line');
      s.send({ t: 'radio', line: line.id });
      return { radio: line.text };
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
        session.markPresent();
        return result(await d.run(session, a, code));
      } catch (e) {
        return failure(e);
      }
    },
  }));
}
