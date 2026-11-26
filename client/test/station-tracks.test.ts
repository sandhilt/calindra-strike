import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMaps, STATIONS } from '@calindra-strike/shared';
import { STATION_TRACKS, StationTracks, trackOffsetSeconds } from '../src/game/station-tracks.ts';

test('tracks wrap on the server clock', () => {
  assert.equal(trackOffsetSeconds(29_500, 12), 5.5);
  assert.equal(trackOffsetSeconds(36_000, 12), 0);
  assert.equal(trackOffsetSeconds(-500, 12), 11.5);
});

test('all map speakers use a configured station with a public asset path', () => {
  assert.deepEqual(Object.keys(STATION_TRACKS), Object.keys(STATIONS));
  for (const [id, track] of Object.entries(STATION_TRACKS)) {
    assert.equal(track.src, `/music/${id}.ogg`);
  }
  for (const map of getMaps()) {
    const speakers = map.props.filter((prop) => prop.kind === 'speaker');
    assert.ok(speakers.length >= 2, map.name);
    for (const { station } of speakers) {
      assert.ok(Object.hasOwn(STATIONS, station), station);
      assert.equal(station, map.id);
    }
  }
});

test('a missing station is fetched once and never decoded or retried', async () => {
  const requests: string[] = [];
  const tracks = new StationTracks((src) => {
    requests.push(src);
    return Promise.resolve(new Response(null, { status: 404 }));
  });
  let decodes = 0;
  const decode = async () => ++decodes;
  assert.equal(tracks.get('forja').kind, 'idle');
  const loading = tracks.load('forja', decode);
  assert.equal(tracks.get('forja').kind, 'loading');
  await Promise.all([loading, tracks.load('forja', decode)]);
  assert.equal(tracks.get('forja').kind, 'silent');
  await tracks.load('forja', decode);
  assert.deepEqual(requests, ['/music/forja.ogg']);
  assert.equal(decodes, 0);
});

test('decoded tracks are reused and decode errors silence their station', async () => {
  const tracks = new StationTracks<number>(() => Promise.resolve(new Response('track')));
  await tracks.load('shopping', async (data) => data.byteLength);
  await tracks.load('shopping', async () => assert.fail('track already decoded'));
  assert.deepEqual(tracks.get('shopping'), { kind: 'ready', buffer: 5 });
  await tracks.load('escritorio', async () => { throw new Error('invalid audio'); });
  assert.equal(tracks.get('escritorio').kind, 'silent');
});
