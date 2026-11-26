import * as THREE from 'three';
import { CollisionWorld, getMaps, TICK_MS, type MapDef } from '@calindra-strike/shared';
import { LightRt, readGpuFacts } from '../game/render/light-rt.ts';
import { renderPixelRatio, type Quality } from '../game/render/quality.ts';
import { RT } from '../game/render/rt-levels.ts';
import { lightRtSupported } from '../game/render/rt-support.ts';
import { buildWorld, followShadow, type WorldView } from '../game/render/world.ts';
import { benchmarkSetup, isRtVariant, type BenchmarkOptions, type BenchmarkTier } from './options.ts';
import { gpuName, heapMb } from './perf-sources.ts';
import { createGpuTimer, medianTiming } from './gpu-timer.ts';
import { recommend, summarize } from './score.ts';
import { buildTour, sampleTour, tourPoints } from './tours.ts';

const WARMUP_MS = 1000;
const TOUR_PITCH = -0.05;
const MONITOR_INTERVAL_MS = 250;
const FPS_WINDOW_MS = 500;

function timingSamples() {
  return { frameMs: new Array<number>(), cpuMs: new Array<number>(), gpuMs: new Array<number>() };
}

type TimingSamples = ReturnType<typeof timingSamples>;

function summarizeTimings({ frameMs, cpuMs, gpuMs }: TimingSamples) {
  return { ...summarize(frameMs), cpuMs: medianTiming(cpuMs) ?? 0, gpuMs: medianTiming(gpuMs) };
}

interface Monitor {
  elapsedPct: number;
  fps: number | null;
  frameMs: number | null;
  cpuMs: number | null;
  gpuMs: number | null;
  gpu: string;
  gpuTimerSupported: boolean;
  heapMb: number | null;
}

interface Progress extends Monitor {
  tier: BenchmarkTier;
  map: string;
  current: number;
  total: number;
}

function nextFrame(signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const frame = requestAnimationFrame((now) => {
      signal.removeEventListener('abort', abort);
      resolve(now);
    });
    function abort() {
      cancelAnimationFrame(frame);
      reject(signal.reason);
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function measure(
  tier: BenchmarkTier,
  map: MapDef,
  ms: number,
  viewport: { width: number; height: number; devicePixelRatio: number },
  host: HTMLElement,
  signal: AbortSignal,
  monitor?: (metrics: Monitor) => void,
) {
  const { profile, rtLevel } = benchmarkSetup(tier);
  const renderer = new THREE.WebGLRenderer({ antialias: profile.antialias, powerPreference: 'high-performance' });
  let world: WorldView | undefined;
  let rt: LightRt | undefined;
  let gpuTimer: ReturnType<typeof createGpuTimer> = null;
  try {
    const { width, height, devicePixelRatio } = viewport;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(renderPixelRatio(profile, devicePixelRatio));
    renderer.setSize(width, height, false);
    renderer.info.autoReset = false;
    host.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(74, width / height, 1, 12000);
    scene.add(camera);
    const view = buildWorld(map, scene, profile);
    world = view;
    const facts = readGpuFacts(renderer);
    const rtProfile = RT[rtLevel];
    if (rtProfile && lightRtSupported(facts)) {
      try {
        rt = new LightRt(renderer, scene, camera, width, height, rtProfile);
      } catch {
        // Match the game's direct-rendering fallback when the pass cannot be created.
      }
    }

    const sunDir = new THREE.Vector3(map.theme.sunDir.x, map.theme.sunDir.y, map.theme.sunDir.z).normalize();
    const collision = new CollisionWorld(map);
    const tour = buildTour(tourPoints(map));
    const gl = renderer.getContext();
    const gpu = gpuName(gl) ?? 'unknown';
    gpuTimer = gl instanceof WebGL2RenderingContext ? createGpuTimer(gl) : null;
    const draw = (elapsedMs: number, dtMs: number) => {
      const { x, y, z, yaw } = sampleTour(tour, collision, elapsedMs);
      camera.position.set(x, y, z);
      camera.rotation.set(TOUR_PITCH, yaw, 0, 'YXZ');
      followShadow(view.sun, x, z, sunDir);
      view.sky.position.copy(camera.position);
      view.update(dtMs / 1000, Math.round(performance.now() / TICK_MS), camera.position);
      renderer.info.reset();
      if (rt) {
        try {
          rt.render();
          return;
        } catch {
          rt.dispose();
          rt = undefined;
          renderer.info.reset();
        }
      }
      renderer.render(scene, camera);
    };

    let last = await nextFrame(signal);
    const warmupStart = last;
    let dtMs = 0;
    monitor?.({
      elapsedPct: 0, fps: null, frameMs: null, cpuMs: null, gpuMs: null,
      gpu, gpuTimerSupported: gpuTimer !== null, heapMb: heapMb(),
    });
    while (last - warmupStart < WARMUP_MS) {
      draw(0, dtMs);
      const now = await nextFrame(signal);
      dtMs = now - last;
      last = now;
    }

    const samples = timingSamples();
    const { frameMs, cpuMs, gpuMs } = samples;
    let lastMonitor = warmupStart;
    let calls = 0;
    let triangles = 0;
    let start = last;
    while (last - start < ms) {
      const hadRt = rt !== undefined;
      gpuTimer?.poll(gpuMs);
      const query = gpuTimer?.begin() ?? null;
      const cpuStart = performance.now();
      let cpu: number;
      try {
        draw(last - start, dtMs);
        cpu = performance.now() - cpuStart;
      } finally {
        gpuTimer?.end(query);
      }
      const now = await nextFrame(signal);
      dtMs = now - last;
      last = now;
      // A run should describe a single rendering path even if RT fails mid-measurement.
      if (hadRt && !rt) {
        frameMs.length = cpuMs.length = gpuMs.length = 0;
        gpuTimer?.discardPending();
        calls = triangles = 0;
        start = now;
        continue;
      }
      frameMs.push(dtMs);
      cpuMs.push(cpu);
      if (monitor && now - lastMonitor >= MONITOR_INTERVAL_MS) {
        lastMonitor = now;
        let windowMs = 0;
        let count = 0;
        for (let i = frameMs.length - 1; i >= 0 && windowMs < FPS_WINDOW_MS; i--) {
          windowMs += frameMs[i];
          count++;
        }
        monitor({
          elapsedPct: Math.min(100, Math.floor(100 * (now - start) / ms)),
          fps: windowMs > 0 ? 1000 * count / windowMs : null,
          frameMs: dtMs, cpuMs: cpu, gpuMs: gpuMs.at(-1) ?? null,
          gpu, gpuTimerSupported: gpuTimer !== null, heapMb: heapMb(),
        });
      }
      calls += renderer.info.render.calls;
      triangles += renderer.info.render.triangles;
    }
    gpuTimer?.poll(gpuMs);
    const frames = frameMs.length;
    return {
      gpu,
      facts,
      samples,
      row: {
        tier, map: map.id, rt: rt !== undefined, rtLevel: rt ? rtLevel : 'off',
        canvasPx: { width: renderer.domElement.width, height: renderer.domElement.height },
        ...summarizeTimings(samples),
        drawCalls: Math.round(calls / frames),
        triangles: Math.round(triangles / frames),
      },
    };
  } finally {
    gpuTimer?.dispose();
    rt?.dispose();
    world?.sun.shadow.dispose();
    world?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
}

export async function runBenchmark(
  host: HTMLElement,
  options: BenchmarkOptions,
  signal: AbortSignal,
  onProgress?: (progress: Progress) => void,
) {
  const maps = getMaps();
  const selectedMaps = options.maps.flatMap((id) => maps.filter((map) => map.id === id));
  const viewport = { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio };
  const total = selectedMaps.length * options.tiers.length * options.rounds;
  const runs: (Awaited<ReturnType<typeof measure>>['row'] & { round: number })[] = [];
  const samples = new Map<BenchmarkTier, TimingSamples>();
  let gpu = 'unknown';
  let facts: ReturnType<typeof readGpuFacts> | null = null;
  for (let round = 1; round <= options.rounds; round++) {
    const tiers = round % 2 ? options.tiers : options.tiers.toReversed();
    for (const map of selectedMaps) {
      for (const tier of tiers) {
        signal.throwIfAborted();
        const progress = { tier, map: map.name, current: runs.length + 1, total };
        const measured = await measure(tier, map, options.ms, viewport, host, signal,
          onProgress && ((metrics) => onProgress({ ...progress, ...metrics })));
        gpu = measured.gpu;
        facts = measured.facts;
        runs.push({ round, ...measured.row });
        const timings = samples.get(tier) ?? timingSamples();
        for (const key of ['frameMs', 'cpuMs', 'gpuMs'] satisfies (keyof TimingSamples)[]) {
          for (const value of measured.samples[key]) timings[key].push(value);
        }
        samples.set(tier, timings);
      }
    }
  }
  const perTier: Partial<Record<Quality, ReturnType<typeof summarizeTimings>>> = {};
  const tiers = [...samples].map(([tier, timings]) => {
    const summary = summarizeTimings(timings);
    if (!isRtVariant(tier)) perTier[tier] = summary;
    return { tier, ...summary };
  });
  const choice = recommend(perTier);
  return {
    gpu, facts, devicePixelRatio: viewport.devicePixelRatio,
    window: { width: viewport.width, height: viewport.height },
    runs, tiers, recommendation: choice,
  };
}

export type BenchmarkResult = Awaited<ReturnType<typeof runBenchmark>>;
