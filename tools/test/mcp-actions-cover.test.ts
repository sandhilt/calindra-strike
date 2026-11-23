import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BTN } from '../../shared/src/index.ts';
import { toolDefinitions } from '../mcp/tools.ts';

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
  ATTACK2: { by: 'zoom', why: 'held ADS or acknowledged AWP scope press' },
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
