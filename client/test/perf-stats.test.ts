import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FrameStats, formatPerfLines, gpuBusyPct } from '../src/debug/perf-stats.ts';

test('frame stats report average cadence, average of the slowest 1% and worst frame', () => {
  const stats = new FrameStats();
  stats.push(0);
  stats.push(NaN);
  assert.equal(stats.snapshot().fps, null);
  for (let i = 0; i < 98; i++) stats.push(10);
  stats.push(25);
  stats.push(50);
  assert.deepEqual(stats.snapshot(), { fps: 1000 / 10.55, frameMs: 10.55, lowFps: 20, worstMs: 50 });
  for (let i = 0; i < 240; i++) stats.push(20);
  assert.deepEqual(stats.snapshot(), { fps: 50, frameMs: 20, lowFps: 50, worstMs: 20 });
});

test('GPU share handles absent timing and clamps to the frame', () => {
  assert.equal(gpuBusyPct(5, 20), 25);
  assert.equal(gpuBusyPct(25, 20), 100);
  assert.equal(gpuBusyPct(-1, 20), 0);
  assert.equal(gpuBusyPct(null, 20), null);
  assert.equal(gpuBusyPct(5, 0), null);
  assert.equal(gpuBusyPct(0, 20), null);
});

test('perf lines show timing and memory only when available', () => {
  const sample = {
    fps: 50, frameMs: 20, lowFps: 40, worstMs: 30, cpuMs: 2, gpuMs: 5,
    gpuName: 'Test GPU', heapMb: 12, calls: 8, triangles: 100, geometries: 5, textures: 3,
  };
  assert.deepEqual(formatPerfLines(sample), [
    '50 fps · quadro 20.00 ms',
    '1% pior 40 fps · pior quadro 30.00 ms',
    'CPU 2.00 ms · GPU 5.00 ms (25% do quadro)',
    'Placa de vídeo: Test GPU',
    'Heap JS: 12.0 MB',
    'Chamadas de desenho 8 · triângulos 100',
    'Geometrias 5 · texturas 3',
  ]);
  const unavailable = formatPerfLines({ ...sample, gpuMs: null, heapMb: null });
  assert.match(unavailable[2], /GPU: indisponível neste navegador/);
  assert.ok(unavailable.every((line) => !line.includes('Heap')));
});

test('the 1% low counts every stutter in the slowest tail', () => {
  const stats = new FrameStats();
  for (let i = 0; i < 238; i++) stats.push(16);
  stats.push(1000);
  stats.push(1000);
  assert.ok((stats.snapshot().lowFps ?? 99) < 2);
});
