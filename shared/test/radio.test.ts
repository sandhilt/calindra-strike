import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RADIO_LINES, RADIO_MENUS, parseClientMessage, radioLine, radioLineAt, radioMenuById } from '../src/index.ts';

describe('radio table', () => {
  it('has the five menus on Z, X, V, B and N with the agreed lines', () => {
    assert.deepEqual(RADIO_MENUS.map((m) => [m.key, m.id, m.lines.length]), [['KeyZ', 'comandos', 6], ['KeyX', 'grupo', 6], ['KeyV', 'respostas', 9], ['KeyB', 'calindra', 9], ['KeyN', 'calindra-2', 2]]);
    assert.deepEqual(radioMenuById('calindra')?.lines.map((l) => l.text), ['Borumbaaa!', 'O cachorro comeu minha branch!', 'Aí é cabeçada!', 'Hoje é quarta-feira, meus bacanos!', 'Eiiiitriiiiii!',
      'ninguém é obrigado estar aqui', 'esses cara do back e do front', 'roda nem um yarn test', 'A batata tá azeitada',
    ]);
    assert.deepEqual(radioMenuById('calindra-2')?.lines.map((l) => l.text), ['Avinagrou', 'Vou dar um soco na sua cara']);
    assert.equal(radioLineAt('comandos', 1)?.text, 'Me cobre!');
    assert.equal(radioLineAt('respostas', 9)?.text, 'Inimigo abatido!');
  });

  it('gives every line a unique id that resolves back to it', () => {
    assert.equal(new Set(RADIO_LINES.map((l) => l.id)).size, RADIO_LINES.length);
    assert.equal(RADIO_LINES.length, RADIO_MENUS.reduce((n, m) => n + m.lines.length, 0));
    RADIO_MENUS.forEach((menu, index) => {
      menu.lines.forEach(({ text }, slotIndex) => {
        const slot = slotIndex + 1;
        const id = (index + 1) * 10 + slot;
        const line = radioLine(id);
        assert.equal(line?.id, id);
        assert.equal(line?.menu, menu.id);
        assert.equal(line?.slot, slot);
        assert.equal(line?.text, text);
        assert.equal(radioLineAt(menu.id, slot), line);
      });
    });
  });

  it('keeps every menu within the nine numbered slots', () => {
    assert.ok(RADIO_MENUS.every((m) => m.lines.length <= 9), 'digits 1-9 must reach every line');
  });

  it('keeps display text separate from the spelling sent to the synthesizer', () => {
    assert.equal(radioLineAt('calindra', 5)?.text, 'Eiiiitriiiiii!');
    assert.notEqual(radioLineAt('calindra', 5)?.speech, 'Eiiiitriiiiii!');
    assert.equal(radioLineAt('comandos', 2)?.speech, 'Vai na frente!');
  });

  it('has no line past the end of a menu', () => {
    assert.equal(radioLineAt('calindra', radioMenuById('calindra')!.lines.length + 1), undefined);
    assert.equal(radioLineAt('comandos', 0), undefined);
  });
});

describe('radio message parsing', () => {
  it('accepts every line id in the table', () => {
    for (const line of RADIO_LINES) assert.deepEqual(parseClientMessage(JSON.stringify({ t: 'radio', line: line.id })), { t: 'radio', line: line.id });
  });

  for (const raw of [
    '{"t":"radio"}',
    '{"t":"radio","line":0}',
    '{"t":"radio","line":10}',
    '{"t":"radio","line":17}',
    '{"t":"radio","line":50}',
    '{"t":"radio","line":53}',
    '{"t":"radio","line":-11}',
    '{"t":"radio","line":11.5}',
    '{"t":"radio","line":"11"}',
    '{"t":"radio","line":null}',
    '{"t":"radio","line":[11]}',
    '{"t":"radio","line":1e999}',
  ]) {
    it(`rejects ${raw}`, () => {
      assert.equal(parseClientMessage(raw), null);
    });
  }
});
