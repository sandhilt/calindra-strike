import type { WebGLRenderer } from 'three';
import { createGpuTimer, medianTiming } from '../benchmark/gpu-timer.ts';
import { gpuName, heapMb } from '../benchmark/perf-sources.ts';
import { h } from '../ui/dom.ts';
import { FrameStats, formatPerfLines } from './perf-stats.ts';

const REFRESH_MS = 250;

export function createPerfHud(renderer: WebGLRenderer) {
  const element = h('pre', { class: 'dbg-perf' });
  const gl = renderer.getContext();
  const timer = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
    ? createGpuTimer(gl) : null;
  const gpu = gpuName(gl);
  const gpuSamples: number[] = [];
  let frames = new FrameStats();
  let lastRefresh = -Infinity;
  renderer.info.autoReset = false;

  function reset() {
    frames = new FrameStats();
    gpuSamples.length = 0;
    timer?.discardPending();
    lastRefresh = -Infinity;
  }

  return {
    element,
    get visible() { return !element.hidden; },
    setVisible(visible: boolean) {
      if (visible === !element.hidden) return;
      element.hidden = !visible;
      reset();
    },
    reset,
    render(draw: () => void, now: number, frameMs: number) {
      renderer.info.reset();
      if (element.hidden) {
        draw();
        return;
      }
      timer?.poll(gpuSamples);
      const query = timer?.begin() ?? null;
      const start = performance.now();
      let cpuMs: number;
      try {
        draw();
        cpuMs = performance.now() - start;
      } finally {
        timer?.end(query);
      }
      frames.push(frameMs);
      if (now - lastRefresh < REFRESH_MS) return;
      lastRefresh = now;
      element.textContent = formatPerfLines({
        ...frames.snapshot(),
        ...renderer.info.render,
        ...renderer.info.memory,
        cpuMs,
        gpuMs: medianTiming(gpuSamples),
        gpuName: gpu,
        heapMb: heapMb(),
      }).join('\n');
      gpuSamples.length = 0;
    },
    dispose() {
      timer?.dispose();
    },
  };
}
