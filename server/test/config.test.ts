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
  it('plays every map with TDM, FFA and CTF by default', () => {
    stubEnv('GAME_MODES', '');
    stubEnv('GAME_MODE', '');
    stubEnv('GAME_MAPS', '');
    const cfg = loadConfig();
    assert.deepEqual(cfg.modes, ['tdm', 'ffa', 'ctf']);
    const game = new Game({ ...base, modes: cfg.modes, maps: cfg.maps });
    assert.equal((game.combos).length, 6);
    assert.deepEqual(new Set(game.combos.map((combo) => combo.mode)), new Set(['tdm', 'ffa', 'ctf']));
    assert.deepEqual(cfg.maps, []);
  });

  it('accepts any list of modes and maps', () => {
    assert.deepEqual(modeList('ffa, tdm', undefined), ['ffa', 'tdm']);
    assert.deepEqual(modeList(undefined, 'mixed'), ['tdm', 'ffa']); // older single setting still works
    assert.deepEqual(modeList(undefined, 'ffa'), ['ffa']);
    assert.deepEqual(modeList('all', undefined), ['tdm', 'ffa', 'ctf']);
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
