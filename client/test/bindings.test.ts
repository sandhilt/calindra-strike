import assert from 'node:assert/strict';
import test from 'node:test';
import { BTN } from '@calindra-strike/shared';
import { Input } from '../src/game/input.ts';
import { ACTIONS, ACTION_IDS, bindingConflicts, canBind, effectiveBindings, mouseBinding, parseBindings, resetBinding, resetBindings, setBinding } from '../src/game/bindings.ts';
import { defaults, loadSettings, saveSettings } from '../src/settings.ts';

test('all actions have valid, distinct default bindings', () => {
  const seen = new Set<string>();
  for (const id of ACTION_IDS) {
    assert.ok(ACTIONS[id].label);
    assert.ok(ACTIONS[id].defaults.length > 0);
    assert.deepEqual(effectiveBindings({}, id), ACTIONS[id].defaults);
    for (const code of ACTIONS[id].defaults) {
      assert.ok(canBind(id, code), code);
      assert.ok(!seen.has(code), code);
      seen.add(code);
    }
  }
});

test('a keyboard or mouse override replaces the defaults for that action', () => {
  const bindings = setBinding(setBinding({}, 'fire', 'KeyU'), 'crouch', 'Mouse3');
  assert.partialDeepStrictEqual(bindings, { fire: ['KeyU'], crouch: ['Mouse3'] });
  assert.deepEqual(effectiveBindings(bindings, 'crouch'), ['Mouse3']);
  assert.deepEqual(effectiveBindings(bindings, 'aim'), ['Mouse2']);
  assert.deepEqual([0, 1, 2, 3, 4].map(mouseBinding), ['Mouse1', 'Mouse3', 'Mouse2', 'Mouse4', 'Mouse5']);
});

test('reset restores every default alias for one action or clears all overrides', () => {
  const bindings = setBinding(setBinding({}, 'leanLeft', 'Mouse3'), 'fire', 'KeyU');
  const reset = resetBinding(bindings, 'leanLeft');
  assert.deepEqual(reset, { fire: ['KeyU'] });
  assert.deepEqual(effectiveBindings(reset, 'leanLeft'), ['ArrowLeft', 'KeyF', 'Mouse4']);
  assert.deepEqual(effectiveBindings(resetBindings(), 'fire'), ['Mouse1']);
  assert.deepEqual(setBinding(bindings, 'fire', 'Mouse1'), { leanLeft: ['Mouse3'] });
});

test('saved data drops unknown actions, reserved codes, duplicates and malformed entries', () => {
  assert.deepEqual(parseBindings(null), {});
  assert.deepEqual(parseBindings([]), {});
  assert.deepEqual(parseBindings({
    fire: ['KeyU'],
    aim: 'Mouse3',
    prone: ['Escape'],
    spray: ['KeyB'],
    jump: ['WheelUp'],
    use: ['bogus'],
    walk: ['KeyU', 'KeyU'],
    crouch: ['KeyC', false],
    reload: ['KeyR'],
    right: [],
    unknown: ['KeyO'],
  }), { fire: ['KeyU'] });
});

test('conflicts use effective bindings and preserve other actions when sharing is accepted', () => {
  assert.deepEqual(bindingConflicts({}, 'fire', ['KeyF', 'Mouse5']), ['leanLeft', 'leanRight']);
  const moved = setBinding({}, 'leanLeft', 'Mouse3');
  assert.deepEqual(bindingConflicts(moved, 'fire', ['KeyF']), []);
  const shared = setBinding(moved, 'fire', 'Mouse3');
  assert.deepEqual(bindingConflicts(shared, 'fire', ['Mouse3']), ['leanLeft']);
  assert.deepEqual(effectiveBindings(shared, 'leanLeft'), ['Mouse3']);
  assert.deepEqual(bindingConflicts(resetBinding(setBinding(moved, 'fire', 'KeyF'), 'leanLeft'), 'leanLeft', ACTIONS.leanLeft.defaults), ['fire']);
});

test('settings round-trip overrides and tolerate old or broken JSON', (t) => {
  const storage = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  saveSettings({ ...defaults(), name: 'Teste', bindings: setBinding(setBinding({}, 'fire', 'KeyU'), 'aim', 'Mouse2') });
  assert.partialDeepStrictEqual(loadSettings(), { name: 'Teste', bindings: { fire: ['KeyU'] } });
  const key = 'calindra-strike:settings:v1';
  const saved: unknown = JSON.parse(storage.get(key) ?? 'null');
  assert.partialDeepStrictEqual(saved, { bindings: { fire: ['KeyU'] } });
  storage.set(key, '{"name":"Antigo","lightRt":false}');
  assert.partialDeepStrictEqual(loadSettings(), { name: 'Antigo', lightRt: 'off', bindings: {} });
  storage.set(key, '{broken');
  assert.deepEqual(loadSettings().bindings, {});
});

test('Input uses remapped mouse and keyboard events and clears held bindings when they change', (t) => {
  const doc = new EventTarget();
  const win = new EventTarget();
  class FakeElement extends EventTarget {
    isContentEditable = false;
    closest() { return null; }
  }
  for (const [key, value] of Object.entries({ document: doc, window: win, HTMLElement: FakeElement })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  const bindings = setBinding(setBinding({}, 'fire', 'KeyU'), 'primary', 'Mouse4');
  const input = new Input(new FakeElement() as unknown as HTMLElement, bindings);
  input.debug = true;
  doc.dispatchEvent(Object.assign(new Event('mousedown'), { button: 0 }));
  assert.equal(input.buttons() & BTN.ATTACK, 0);
  doc.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyU' }));
  assert.equal(input.buttons() & BTN.ATTACK, BTN.ATTACK);
  doc.dispatchEvent(Object.assign(new Event('mousedown'), { button: 3 }));
  assert.equal(input.takeWeaponRequest(), 1);
  input.setBindings(resetBindings());
  assert.equal(input.buttons(), 0);
  input.dispose();
});
