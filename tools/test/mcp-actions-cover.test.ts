import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BTN } from '../../shared/src/index.ts';
import { toolDefinitions } from '../mcp/tools.ts';
import { ACTIONS, type ActionId } from '../../client/src/game/bindings.ts';

/**
 * Every input bit a player can press, and how an MCP agent presses it. A new BTN bit fails the typecheck
 * and this test until it names a tool (or the pilot) and says why, so a new action cannot ship read-only.
 * Adding the tool also means its description, README.md, the play skill and the MCP pin (see AGENTS.md).
 */
const COVER: Record<keyof typeof BTN, { by: string; why: string }> = {
  FWD: { by: 'brain', why: 'move_to, attack and hunt walk the pilot along its route' },
  BACK: { by: 'brain', why: 'the pilot backs off and strafes while it fights' },
  LEFT: { by: 'brain', why: 'the pilot strafes while it fights' },
  RIGHT: { by: 'brain', why: 'the pilot strafes while it fights' },
  JUMP: { by: 'jump', why: 'one jump on the ground' },
  DUCK: { by: 'crouch', why: 'latched crouch; slide also presses it for one command' },
  WALK: { by: 'walk', why: 'latched silent walk' },
  ATTACK: { by: 'fire', why: 'timed trigger hold; the pilot also fires on attack and hunt' },
  ATTACK2: { by: 'zoom', why: 'held ADS or acknowledged AWP scope press; the hammer heavy swing is fire with heavy: true' },
  RELOAD: { by: 'reload', why: 'one reload' },
  USE: { by: 'use', why: 'hold to plant, defuse or call colleagues' },
  SPRINT: { by: 'sprint', why: 'latched sprint' },
  LEAN_LEFT: { by: 'lean', why: 'latched lean, side left' },
  LEAN_RIGHT: { by: 'lean', why: 'latched lean, side right' },
  PRONE: { by: 'prone', why: 'latched prone' },
};

test('every BTN bit is covered by an MCP tool or the pilot', () => {
  const missing = Object.keys(BTN).filter((key) => !Object.hasOwn(COVER, key));
  assert.deepEqual(missing, [], `BTN bits with no MCP coverage: add each to COVER in this file and build its tool in tools/mcp/tools.ts`);
});

test('the cover table lists no bit that BTN does not have', () => {
  assert.deepEqual(Object.keys(COVER).filter((key) => !Object.hasOwn(BTN, key)), []);
});

test('every covering tool exists in the MCP tool list and says why', () => {
  const names = new Set(toolDefinitions.map((d) => d.name));
  for (const [key, { by, why }] of Object.entries(COVER)) {
    assert.ok(by === 'brain' || names.has(by), `BTN.${key} names the tool "${by}", which tools/mcp/tools.ts does not define`);
    assert.ok(why.trim().length > 0, `BTN.${key} needs a reason`);
  }
});

/**
 * Every remappable key, including the ones that are not a BTN bit (spray, the wheel, scoreboard, chat).
 * A new ActionId fails the typecheck and this test until it names a tool, so a key cannot ship browser-only.
 */
const KEY_COVER: Record<ActionId, { by: string; why: string }> = {
  forward: { by: 'brain', why: 'move_to, attack and hunt walk the pilot along its route' },
  back: { by: 'brain', why: 'the pilot backs off while it fights' },
  left: { by: 'brain', why: 'the pilot strafes while it fights' },
  right: { by: 'brain', why: 'the pilot strafes while it fights' },
  jump: { by: 'jump', why: 'one jump on the ground' },
  crouch: { by: 'crouch', why: 'latched crouch; slide also presses it' },
  sprint: { by: 'sprint', why: 'latched sprint' },
  walk: { by: 'walk', why: 'latched silent walk' },
  leanLeft: { by: 'lean', why: 'latched lean, side left' },
  leanRight: { by: 'lean', why: 'latched lean, side right' },
  prone: { by: 'prone', why: 'latched prone' },
  fire: { by: 'fire', why: 'timed trigger hold' },
  aim: { by: 'zoom', why: 'held ADS or AWP scope press; fire heavy: true on the hammer' },
  reload: { by: 'reload', why: 'one reload' },
  use: { by: 'use', why: 'hold to plant, defuse or call colleagues' },
  primary: { by: 'switch_weapon', why: 'slot primary' },
  secondary: { by: 'switch_weapon', why: 'slot pistol' },
  melee: { by: 'switch_weapon', why: 'slot hammer' },
  lastWeapon: { by: 'switch_weapon', why: 'slot last' },
  nextWeapon: { by: 'cycle_weapon', why: 'direction next, the wheel down' },
  previousWeapon: { by: 'cycle_weapon', why: 'direction previous, the wheel up' },
  spray: { by: 'spray', why: 'places the decal on the wall ahead' },
  scoreboard: { by: 'get_state', why: 'scores in get_state' },
  chat: { by: 'say', why: 'chat line; radio sends the prepared lines' },
};

test('every remappable key is covered by an MCP tool or the pilot', () => {
  const missing = Object.keys(ACTIONS).filter((id) => !Object.hasOwn(KEY_COVER, id));
  assert.deepEqual(missing, [], 'keys with no MCP coverage: add each to KEY_COVER in this file and build its tool in tools/mcp/tools.ts');
  assert.deepEqual(Object.keys(KEY_COVER).filter((id) => !Object.hasOwn(ACTIONS, id)), []);
});

test('every key-covering tool exists in the MCP tool list and says why', () => {
  const names = new Set(toolDefinitions.map((d) => d.name));
  for (const [id, { by, why }] of Object.entries(KEY_COVER)) {
    assert.ok(by === 'brain' || names.has(by), `${id} names the tool "${by}", which tools/mcp/tools.ts does not define`);
    assert.ok(why.trim().length > 0, `${id} needs a reason`);
  }
});
