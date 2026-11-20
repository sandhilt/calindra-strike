import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, mapList, modeList } from '../src/config.ts';
import { Game } from '../src/game.ts';

const originalEnv = new Map<string, string | undefined>();

function stubEnv(name: string, value: string) {
  if (!originalEnv.has(name)) originalEnv.set(name, process.env[name]);
  process.env[name] = value;
}

afterEach(() => {
  for (const [name, value] of originalEnv) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  originalEnv.clear();
});

const base = { maxPlayers: 24, matchMs: 300_000, podiumMs: 5000, warmupMinPlayers: 2 };

describe('map and mode selection', () => {
  it('plays every map with TDM, FFA, CTF and debug defusion by default', () => {
    stubEnv('GAME_MODES', '');
    stubEnv('GAME_MODE', '');
    stubEnv('GAME_MAPS', '');
    const cfg = loadConfig();
    assert.deepEqual(cfg.modes, ['tdm', 'ffa', 'ctf', 'defuse']);
    const game = new Game({ ...base, modes: cfg.modes, maps: cfg.maps });
    assert.equal((game.combos).length, 8);
    assert.deepEqual(new Set(game.combos.map((combo) => combo.mode)), new Set(['tdm', 'ffa', 'ctf', 'defuse']));
    assert.deepEqual(cfg.maps, []);
  });

  it('accepts any list of modes and maps', () => {
    assert.deepEqual(modeList('ffa, tdm', undefined), ['ffa', 'tdm']);
    assert.deepEqual(modeList(undefined, 'mixed'), ['tdm', 'ffa']); // older single setting still works
    assert.deepEqual(modeList(undefined, 'ffa'), ['ffa']);
    assert.deepEqual(modeList('all', undefined), ['tdm', 'ffa', 'ctf', 'defuse']);
    assert.deepEqual(mapList('escritorio'), ['escritorio']);
    assert.deepEqual(mapList('forja,escritorio,forja'), ['forja', 'escritorio']);
    assert.throws(() => modeList('tdm,zombies', undefined), /Invalid game mode: zombies/);
    assert.throws(() => mapList('dust2'), /Invalid map: dust2/);
  });

  it('rotates through exactly the chosen combinations, changing map every match', () => {
    const game = new Game({ ...base, modes: ['tdm', 'ffa'], maps: ['forja', 'escritorio'] });
    assert.deepEqual(game.combos.map((c) => `${c.mode}@${c.map}`), ['tdm@0', 'ffa@1', 'ffa@0', 'tdm@1']);
    const only = new Game({ ...base, modes: ['ffa'], maps: ['escritorio'] });
    assert.deepEqual(only.combos, [{ map: 1, mode: 'ffa' }]);
    assert.equal(only.map.id, 'escritorio');
    assert.equal(only.mode, 'ffa');
  });

  it('only offers configured combinations in the end-of-match vote', () => {
    const game = new Game({ ...base, modes: ['tdm', 'ffa'], maps: ['forja', 'escritorio'], random: () => 0.5 });
    game.join('A', 0, 2, () => {});
    game.join('B', 0, 2, () => {});
    (game as any).phaseEnds = game.now();
    game.update();
    const options = (game as any).voteOptions as { map: number; mode: string }[];
    assert.equal(options.length, 3);
    assert.equal(options.every((o) => o.mode === 'tdm' || o.mode === 'ffa'), true);
  });

  it('rejects unknown maps', () => {
    assert.throws(() => new Game({ ...base, maps: ['dust2'] }), /Unknown map: dust2/);
  });
});

it('configures the capture limit within 0..50', () => {
  stubEnv('CTF_CAPTURE_LIMIT', '');
  assert.equal(loadConfig().ctfLimit, 3);
  for (const value of [0, 3, 50]) {
    stubEnv('CTF_CAPTURE_LIMIT', String(value));
    assert.equal(loadConfig().ctfLimit, value);
  }
  for (const value of ['-1', '51', 'abc']) {
    stubEnv('CTF_CAPTURE_LIMIT', value);
    assert.throws(() => loadConfig(), /CTF_CAPTURE_LIMIT/);
  }
});

it('turns friendly fire on only when the operator asks for it', () => {
  stubEnv('FRIENDLY_FIRE', '');
  assert.equal(loadConfig().friendlyFire, false);
  for (const value of ['0', 'false']) {
    stubEnv('FRIENDLY_FIRE', value);
    assert.equal(loadConfig().friendlyFire, false);
  }
  for (const value of ['1', 'true', 'TRUE']) {
    stubEnv('FRIENDLY_FIRE', value);
    assert.equal(loadConfig().friendlyFire, true);
  }
  stubEnv('FRIENDLY_FIRE', 'yes');
  assert.throws(() => loadConfig(), /FRIENDLY_FIRE/);
});

it('kicks unready and idle players by default and lets the operator turn each off or retime it', () => {
  stubEnv('READY_KICK', '');
  stubEnv('READY_KICK_SECONDS', '');
  stubEnv('IDLE_KICK', '');
  stubEnv('IDLE_KICK_SECONDS', '');
  assert.equal(loadConfig().readyKickMs, 180_000);
  assert.equal(loadConfig().idleKickMs, 60_000);
  stubEnv('READY_KICK_SECONDS', '45');
  stubEnv('IDLE_KICK_SECONDS', '120');
  assert.equal(loadConfig().readyKickMs, 45_000);
  assert.equal(loadConfig().idleKickMs, 120_000);
  stubEnv('READY_KICK', '0');
  stubEnv('IDLE_KICK', 'false');
  assert.equal(loadConfig().readyKickMs, 0);
  assert.equal(loadConfig().idleKickMs, 0);
  stubEnv('READY_KICK', '1');
  for (const [name, value] of [['READY_KICK_SECONDS', '4'], ['READY_KICK_SECONDS', '601'], ['READY_KICK', 'yes']]) {
    stubEnv(name, value);
    assert.throws(() => loadConfig(), new RegExp(name));
    stubEnv(name, name === 'READY_KICK' ? '1' : '20');
  }
  stubEnv('IDLE_KICK', '1');
  for (const value of ['9', '3601']) {
    stubEnv('IDLE_KICK_SECONDS', value);
    assert.throws(() => loadConfig(), /IDLE_KICK_SECONDS/);
  }
});

it('configures the radio spam guard', () => {
  for (const name of ['RADIO_COOLDOWN_SECONDS', 'RADIO_MAX_PER_WINDOW', 'RADIO_WINDOW_SECONDS']) stubEnv(name, '');
  assert.deepEqual(loadConfig().radio, { cooldownMs: 1_500, maxPerWindow: 3, windowMs: 10_000 });
  stubEnv('RADIO_COOLDOWN_SECONDS', '2.5');
  stubEnv('RADIO_MAX_PER_WINDOW', '0');
  stubEnv('RADIO_WINDOW_SECONDS', '30');
  assert.deepEqual(loadConfig().radio, { cooldownMs: 2_500, maxPerWindow: 0, windowMs: 30_000 });
  for (const [name, value] of [['RADIO_COOLDOWN_SECONDS', '-1'], ['RADIO_COOLDOWN_SECONDS', 'x'], ['RADIO_MAX_PER_WINDOW', '1.5'], ['RADIO_WINDOW_SECONDS', '0']]) {
    stubEnv(name, value);
    assert.throws(() => loadConfig(), new RegExp(name));
    stubEnv(name, '');
  }
});

it('configures the debug defusion plant timeout in seconds within 0..3600', () => {
  stubEnv('DEFUSE_PLANT_TIMEOUT_SECONDS', '');
  assert.equal(loadConfig().plantTimeoutMs, 30_000);
  for (const [value, ms] of [['0', 0], ['90', 90_000], ['3600', 3_600_000]] as const) {
    stubEnv('DEFUSE_PLANT_TIMEOUT_SECONDS', value);
    assert.equal(loadConfig().plantTimeoutMs, ms);
  }
  for (const value of ['-1', '3601', 'abc']) {
    stubEnv('DEFUSE_PLANT_TIMEOUT_SECONDS', value);
    assert.throws(() => loadConfig(), /DEFUSE_PLANT_TIMEOUT_SECONDS/);
  }
});

it('configures the debug defusion round limit within 0..50', () => {
  stubEnv('DEFUSE_SCORE_LIMIT', '');
  assert.equal(loadConfig().defuseLimit, 5);
  for (const value of [0, 5, 50]) {
    stubEnv('DEFUSE_SCORE_LIMIT', String(value));
    assert.equal(loadConfig().defuseLimit, value);
  }
  for (const value of ['-1', '51', 'abc']) {
    stubEnv('DEFUSE_SCORE_LIMIT', value);
    assert.throws(() => loadConfig(), /DEFUSE_SCORE_LIMIT/);
  }
});
