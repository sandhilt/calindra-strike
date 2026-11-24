import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMap, type CookVoice, type MapProp } from '../src/index.ts';

const map = getMap(2);
type Cook = Extract<MapProp, { kind: 'cook' }>;
type Flame = Extract<MapProp, { kind: 'flame' }>;
const cooks = map.props.filter((p): p is Cook => p.kind === 'cook');
const flames = map.props.filter((p): p is Flame => p.kind === 'flame');

/** The food court deck is at 192 and the kitchen platform 28 above it; the lid is at 176 over the deck. */
const KITCHEN_Y_MIN = 192 + 28;
const KITCHEN_Y_MAX = 192 + 176;
const KITCHEN_Z_MIN = 1440;
const KITCHEN_Z_MAX = 1536;
const KITCHEN_HALF_WIDTH = 160;

describe('kitchen ambience on Shopping Sul Rio', () => {
  it('has a cooking sound and fire inside every kitchen, nowhere else', () => {
    assert.ok(cooks.length >= 8 && flames.length >= 8);
    for (const p of [...cooks, ...flames]) {
      assert.ok(Math.abs(p.z) >= KITCHEN_Z_MIN && Math.abs(p.z) <= KITCHEN_Z_MAX, `${p.kind} at z ${p.z} is outside the kitchens`);
      assert.ok(p.y >= KITCHEN_Y_MIN && p.y <= KITCHEN_Y_MAX, `${p.kind} at y ${p.y} is not over a kitchen platform`);
    }
  });

  it('gives each of the eight restaurants at least one cooking sound', () => {
    assert.equal(map.restaurants.length, 8);
    for (const restaurant of map.restaurants) {
      const own = cooks.filter((c) => Math.abs(c.x - restaurant.x) <= KITCHEN_HALF_WIDTH && Math.sign(c.z) === Math.sign(restaurant.z));
      assert.ok(own.length >= 1, `${restaurant.name} has no cooking sound`);
    }
  });

  it('uses every voice, so fast food and grills sound different from each other', () => {
    const voices = new Set<CookVoice>(cooks.map((c) => c.voice));
    assert.deepEqual([...voices].toSorted(), ['charcoal', 'fryer', 'griddle', 'wood']);
  });

  it('sounds and burns in both halves of the mall, whose food courts hold different restaurants', () => {
    for (const side of [-1, 1]) {
      assert.ok(cooks.some((c) => Math.sign(c.z) === side), `no cooking sound on the ${side < 0 ? 'north' : 'south'} side`);
      assert.ok(flames.some((f) => Math.sign(f.z) === side), `no fire on the ${side < 0 ? 'north' : 'south'} side`);
    }
  });

  it('puts fire only where something is cooked over fire: grills, the wood oven and the flame grill', () => {
    for (const f of flames) {
      assert.ok(f.size >= 6 && f.size <= 20, `a flame ${f.size} units tall`);
      const near = cooks.some((c) => Math.abs(c.x - f.x) <= KITCHEN_HALF_WIDTH && Math.sign(c.z) === Math.sign(f.z));
      assert.ok(near, `a flame at ${f.x},${f.z} with no cooking sound in its kitchen`);
    }
  });
});
