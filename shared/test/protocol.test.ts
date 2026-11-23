import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MODE_RULES, RESPAWN_OBJECTIVE_TICKS, RESPAWN_TICKS, GAME_MODES, BTN, BTN_MASK, RF_AIM, RF_ALIVE, RF_DUCK, RF_GROUND, RF_PRONE, RF_SLIDE, RF_SPRINT, RF_ZOOM, STANCE, leanOfRow, parseClientMessage, sanitizeChat, sanitizeName, stanceFromFlags } from '../src/index.ts';

describe('parseClientMessage', () => {
  it('accepts a valid hello and input packet', () => {
    assert.partialDeepStrictEqual(parseClientMessage(JSON.stringify({ t: 'hello', v: 3, name: 'Gabi', color: 2, primary: 2 })), { t: 'hello', code: '' });
    const m = parseClientMessage(JSON.stringify({ t: 'in', c: [[1, 129, 0.5, -0.1, 0, 12345]] }));
    assert.deepEqual(m, { t: 'in', c: [{ seq: 1, buttons: 129, yaw: 0.5, pitch: -0.1, weapon: 0, interp: 12345 }] });
  });

  it('accepts a bare ready', () => {
    assert.deepEqual(parseClientMessage('{"t":"ready"}'), { t: 'ready' });
    assert.deepEqual(parseClientMessage('{"t":"active"}'), { t: 'active' });
  });

  for (const raw of [
    'not json',
    '[]',
    'null',
    '{"t":"nope"}',
    '{"t":"in","c":[]}',
    '{"t":"in","c":[[1,99999,0,0,0,0]]}',
    '{"t":"in","c":[[1,1,"NaN",0,0,0]]}',
    '{"t":"in","c":[[1,1,0,0,9,0]]}',
    '{"t":"in","c":[[1.5,1,0,0,0,0]]}',
    '{"t":"hello","v":3,"name":"x","color":99,"primary":2}',
    '{"t":"hello","v":3,"name":"x","color":1,"primary":5}',
    '{"t":"loadout","primary":6}',
    '{"t":"chat","text":""}',
    '{"t":"__proto__"}',
    '{"t":"ready","now":true}',
    '{"t":"active","x":1}',
  ]) {
    it(`rejects ${raw}`, () => {
      assert.equal(parseClientMessage(raw), null);
    });
  }

  it('accepts every button bit and rejects the next one', () => {
    assert.equal(BTN_MASK, Object.values(BTN).reduce((all, bit) => all | bit, 0));
    assert.partialDeepStrictEqual(parseClientMessage(JSON.stringify({ t: 'in', c: [[1, BTN.USE | BTN.FWD, 0, 0, 0, 0]] })), { t: 'in' });
    assert.equal(parseClientMessage(JSON.stringify({ t: 'in', c: [[1, BTN_MASK + 1, 0, 0, 0, 0]] })), null);
  });

  it('rejects oversized payloads and too many commands', () => {
    assert.equal(parseClientMessage('x'.repeat(5000)), null);
    const c = Array.from({ length: 13 }, (_, i) => [i, 0, 0, 0, 0, 0]);
    assert.equal(parseClientMessage(JSON.stringify({ t: 'in', c })), null);
  });
});

describe('sanitizers', () => {
  it('strips control, bidi and markup characters from names', () => {
    assert.equal(sanitizeName('  <b>Gabi</b>‮\u0000  '), 'bGabib');
    assert.equal(sanitizeName('José Ação'), 'José Ação');
    assert.equal(sanitizeName('a'.repeat(40)).length, 16);
    assert.equal(sanitizeName('Z͓͑͒algo'), 'Zalgo');
  });

  it('keeps chat readable but bounded', () => {
    assert.equal(sanitizeChat('gg wp!! 🔥'), 'gg wp!! 🔥');
    assert.equal(sanitizeChat('a\nb\tc'), 'abc');
    assert.equal(sanitizeChat('x'.repeat(500)).length, 100);
  });
});

it('validates spectator joins and team choices', () => {
  const hello = { t: 'hello', v: 8, name: 'Viewer', color: 0, primary: 2 };
  assert.partialDeepStrictEqual(parseClientMessage(JSON.stringify(hello)), { spectate: false });
  assert.partialDeepStrictEqual(parseClientMessage(JSON.stringify({ ...hello, spectate: true })), { spectate: true });
  assert.equal(parseClientMessage(JSON.stringify({ ...hello, spectate: 1 })), null);
  for (const team of [0, 1]) assert.deepStrictEqual(parseClientMessage(JSON.stringify({ t: 'watch', team })), { t: 'watch', team });
  for (const team of [-1, 2, '0', null, 0.5]) assert.equal(parseClientMessage(JSON.stringify({ t: 'watch', team })), null);
});

it('accepts only the payload-free spray message', () => {
  assert.deepEqual(parseClientMessage('{"t":"spray"}'), { t: 'spray' });
  for (const raw of [
    '{"t":"spray","p":[0,0,0]}',
    '{"t":"spray","junk":null}',
    '{"t":["spray"]}',
    '["spray"]',
  ]) assert.equal(parseClientMessage(raw), null);
});

describe('remote player rows', () => {
  it('reads the stance from the flags, prone before crouch', () => {
    assert.equal(stanceFromFlags(RF_ALIVE), STANCE.STAND);
    assert.equal(stanceFromFlags(RF_ALIVE | RF_DUCK), STANCE.CROUCH);
    assert.equal(stanceFromFlags(RF_ALIVE | RF_PRONE), STANCE.PRONE);
    assert.equal(stanceFromFlags(RF_PRONE | RF_DUCK | RF_SLIDE), STANCE.PRONE);
    assert.equal(stanceFromFlags(RF_SPRINT | RF_SLIDE | RF_GROUND), STANCE.STAND);
  });

  it('gives every row flag its own bit', () => {
    const bits = [RF_DUCK, RF_ALIVE, RF_GROUND, RF_ZOOM, RF_PRONE, RF_SPRINT, RF_SLIDE, RF_AIM];
    assert.equal(new Set(bits).size, bits.length);
    assert.equal(bits.reduce((all, bit) => all | bit, 0), bits.reduce((all, bit) => all + bit, 0));
  });

  it('treats a row without the lean field as not leaning', () => {
    assert.equal(leanOfRow([1, 0, 0, 0, 0, 0, RF_ALIVE, 2]), 0);
    assert.equal(leanOfRow([1, 0, 0, 0, 0, 0, RF_ALIVE, 2, -0.45]), -0.45);
  });
});

describe('respawn time by mode', () => {
  it('keeps the quick respawn in the deathmatches and waits longer in every objective mode', () => {
    assert.equal(MODE_RULES.ffa.respawnTicks, RESPAWN_TICKS);
    assert.equal(MODE_RULES.tdm.respawnTicks, RESPAWN_TICKS);
    for (const mode of GAME_MODES.filter((m) => m !== 'ffa' && m !== 'tdm')) assert.equal(MODE_RULES[mode].respawnTicks, RESPAWN_OBJECTIVE_TICKS, mode);
    assert.ok(RESPAWN_OBJECTIVE_TICKS > RESPAWN_TICKS);
  });
});
