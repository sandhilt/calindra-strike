import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RADIO_COOLDOWN_TICKS, TICK_MS, WEAPON, radioLineAt, type GameMode, type ServerMsg } from '@calindra-strike/shared';
import { Game, type GameOptions, type ServerPlayer, type Spectator } from '../src/game.ts';

const LINE = radioLineAt('comandos', 1)!.id;
const OTHER_LINE = radioLineAt('calindra', 5)!.id;

function setup(mode: GameMode, players: number, opts: Partial<GameOptions> = {}) {
  const game = new Game({ maxPlayers: 16, matchMs: 120_000, podiumMs: 5_000, warmupMinPlayers: 2, modes: mode, random: () => 0.3, ...opts });
  const inbox = new Map<number, ServerMsg[]>();
  const joined: ServerPlayer[] = [];
  for (let i = 0; i < players; i++) {
    const box: ServerMsg[] = [];
    const p = game.join(`P${i}`, 0, WEAPON.RIFLE, (d) => box.push(JSON.parse(d))) as ServerPlayer;
    inbox.set(p.id, box);
    joined.push(p);
  }
  const spectate = (): { s: Spectator; box: ServerMsg[] } => {
    const box: ServerMsg[] = [];
    const s = game.spectate('Watcher', (d) => box.push(JSON.parse(d))) as Spectator;
    return { s, box };
  };
  const radios = (box: ServerMsg[]) => box.filter((m) => m.t === 'radio');
  return { game, joined, inbox, spectate, radios };
}

describe('radio delivery', () => {
  for (const mode of ['tdm', 'ctf', 'defuse'] as const) {
    it(`reaches teammates and the sender but not the other team in ${mode}`, () => {
      const { game, joined, inbox, radios } = setup(mode, 6);
      const speaker = joined[0];
      game.radio(speaker, LINE);
      for (const p of joined) {
        const got = radios(inbox.get(p.id)!);
        if (p.team === speaker.team) assert.deepEqual(got, [{ t: 'radio', id: speaker.id, line: LINE }], `${p.name} is on the speaker's team`);
        else assert.equal(got.length, 0, `${p.name} is on the other team`);
      }
      assert.ok(joined.some((p) => p.team !== speaker.team), 'the roster has an opposing team');
    });
  }

  it('reaches everyone in free-for-all', () => {
    const { game, joined, inbox, radios } = setup('ffa', 4);
    game.radio(joined[1], LINE);
    for (const p of joined) assert.equal(radios(inbox.get(p.id)!).length, 1);
  });

  it('is delivered to dead players too, since the sender may be waiting to respawn', () => {
    const { game, joined, inbox, radios } = setup('tdm', 4);
    const speaker = joined[0];
    const mate = joined.find((p) => p !== speaker && p.team === speaker.team)!;
    mate.alive = false;
    speaker.alive = false;
    game.radio(speaker, LINE);
    assert.equal(radios(inbox.get(mate.id)!).length, 1);
    assert.equal(radios(inbox.get(speaker.id)!).length, 1);
  });

  it('reaches spectators watching the speaker team, not the other one', () => {
    const { game, joined, spectate, radios } = setup('tdm', 4);
    const speaker = joined[0];
    const same = spectate();
    const other = spectate();
    const choosing = spectate();
    game.watch(same.s, speaker.team);
    game.watch(other.s, 1 - speaker.team);
    game.radio(speaker, LINE);
    assert.equal(radios(same.box).length, 1);
    assert.equal(radios(other.box).length, 0);
    assert.equal(radios(choosing.box).length, 0, 'a spectator who has not picked a side hears nothing');
  });

  it('reaches every spectator in free-for-all, where they watch team -1', () => {
    const { game, joined, spectate, radios } = setup('ffa', 3);
    const a = spectate();
    assert.deepEqual(a.s.view, { kind: 'watching', team: -1 });
    game.radio(joined[0], LINE);
    assert.equal(radios(a.box).length, 1);
  });
});

describe('radio cooldown', () => {
  it('drops a second line inside the cooldown and allows it right after', () => {
    const { game, joined, inbox, radios } = setup('ffa', 2);
    const speaker = joined[0];
    game.radio(speaker, LINE);
    game.tick += RADIO_COOLDOWN_TICKS - 1;
    game.radio(speaker, OTHER_LINE);
    assert.equal(radios(inbox.get(speaker.id)!).length, 1);
    game.tick += 1;
    game.radio(speaker, OTHER_LINE);
    assert.deepEqual(radios(inbox.get(speaker.id)!).map((m) => m.t === 'radio' && m.line), [LINE, OTHER_LINE]);
  });

  it('caps the lines in a sliding window and frees a slot when the oldest leaves it', () => {
    const { game, joined, inbox, radios } = setup('ffa', 2, { radio: { cooldownMs: 1_500, maxPerWindow: 3, windowMs: 10_000 } });
    const speaker = joined[0];
    const sent = () => radios(inbox.get(speaker.id)!).length;
    const at = (ms: number) => { game.tick = Math.round(ms / TICK_MS); };
    for (const ms of [0, 1_500, 3_000, 4_500, 9_900]) {
      at(ms);
      game.radio(speaker, LINE);
    }
    assert.equal(sent(), 3, 'the 4th and 5th lines fall inside the 10 s window');
    at(10_000);
    game.radio(speaker, LINE);
    assert.equal(sent(), 4, 'the line at 0 s has left the window');
  });

  it('is per player', () => {
    const { game, joined, inbox, radios } = setup('ffa', 2);
    game.radio(joined[0], LINE);
    game.radio(joined[1], LINE);
    assert.equal(radios(inbox.get(joined[0].id)!).length, 2);
  });
});
