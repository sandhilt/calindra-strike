import assert from 'node:assert/strict';
import { it } from 'node:test';
import { LEAD_ANNOUNCEMENT_INTERVAL_MS as interval } from '../src/constants.ts';
import { leadAnnouncement, outrightLeader } from '../src/lead.ts';

it('reports an outright positive leader and ignores ties', () => {
  assert.equal(outrightLeader([[0, 0]]), null);
  assert.equal(outrightLeader([[2, 4], [3, 4]]), null);
  assert.equal(outrightLeader([[2, 4], [3, 4], [0, 5]]), 0);
});

it('announces changes and reminders through one shared cooldown', () => {
  const first = leadAnnouncement({ announced: null, at: -Infinity }, 0, 100);
  assert.deepEqual(first, { announced: 0, at: 100, what: 'takes' });
  assert.ok(first);
  assert.equal(leadAnnouncement(first, 1, 100 + interval - 1), null);
  assert.equal(leadAnnouncement(first, null, 100 + interval), null);
  assert.equal(leadAnnouncement(first, 1, 100 + interval)?.what, 'takes');
  assert.equal(leadAnnouncement(first, 0, 100 + interval)?.what, 'continues');
});
