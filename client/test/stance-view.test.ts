import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STANCE } from '@calindra-strike/shared';
import { STANCE_VIEWS } from '../src/ui/stance-view.ts';
import { ICONS } from '../src/ui/icons.ts';

test('every stance has its own icon and a Portuguese name', () => {
  const rows = Object.values(STANCE).map((stance) => STANCE_VIEWS[stance]);
  assert.deepEqual(rows.map((row) => row.label), ['em pé', 'agachado', 'deitado']);
  assert.equal(new Set(rows.map((row) => row.icon)).size, rows.length);
  for (const row of rows) assert.match(ICONS[row.icon], /^<svg viewBox="0 0 24 24"/);
});
