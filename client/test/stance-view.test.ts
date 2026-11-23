import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STANCE } from '@calindra-strike/shared';
import { STANCE_VIEWS, leanTilt } from '../src/ui/stance-view.ts';
import { ICONS } from '../src/ui/icons.ts';

test('every stance has its own icon and a Portuguese name', () => {
  const rows = Object.values(STANCE).map((stance) => STANCE_VIEWS[stance]);
  assert.deepEqual(rows.map((row) => row.label), ['em pé', 'agachado', 'deitado']);
  assert.equal(new Set(rows.map((row) => row.icon)).size, rows.length);
  for (const row of rows) assert.match(ICONS[row.icon], /^<svg viewBox="0 0 24 24"/);
});

test('a lean tilts the icon toward its side and adds an arrow, upright draws neither', () => {
  assert.deepEqual(leanTilt(0), { degrees: 0, arrow: '' });
  assert.deepEqual(leanTilt(0.05), { degrees: 0, arrow: '' });
  assert.deepEqual(leanTilt(1), { degrees: 20, arrow: '›' });
  assert.deepEqual(leanTilt(-1), { degrees: -20, arrow: '‹' });
  assert.deepEqual(leanTilt(-0.5), { degrees: -12, arrow: '‹' });
  assert.deepEqual(leanTilt(0.5), { degrees: 12, arrow: '›' });
});

test('the lying down icon has feet', () => {
  assert.match(ICONS.stanceProne, /M21 19h2/);
});
