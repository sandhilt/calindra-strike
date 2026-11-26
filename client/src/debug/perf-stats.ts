const FRAME_WINDOW = 240;
const MS_PER_SECOND = 1000;

export interface PerfSample {
  fps: number | null;
  frameMs: number | null;
  lowFps: number | null;
  worstMs: number | null;
  cpuMs: number | null;
  gpuMs: number | null;
  gpuName: string | null;
  heapMb: number | null;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export class FrameStats {
  private readonly frames: number[] = [];
  private next = 0;

  push(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    this.frames[this.next] = frameMs;
    this.next = (this.next + 1) % FRAME_WINDOW;
  }

  snapshot(): Pick<PerfSample, 'fps' | 'frameMs' | 'lowFps' | 'worstMs'> {
    const sorted = this.frames.toSorted((a, b) => a - b);
    if (!sorted.length) return { fps: null, frameMs: null, lowFps: null, worstMs: null };
    const frameMs = sorted.reduce((sum, ms) => sum + ms, 0) / sorted.length;
    const p99 = sorted[Math.ceil(sorted.length * 0.99) - 1];
    return { fps: MS_PER_SECOND / frameMs, frameMs, lowFps: MS_PER_SECOND / p99, worstMs: sorted[sorted.length - 1] };
  }
}

export function gpuBusyPct(gpuMs: number | null, frameMs: number | null): number | null {
  if (!gpuMs || !frameMs) return null;
  return Math.max(0, Math.min(100, gpuMs / frameMs * 100));
}

export function formatPerfLines(sample: PerfSample): string[] {
  const ms = (n: number | null) => n?.toFixed(2) ?? '—';
  const fps = (n: number | null) => n === null ? '—' : String(Math.round(n));
  const pct = gpuBusyPct(sample.gpuMs, sample.frameMs);
  const gpu = sample.gpuMs === null ? 'GPU: indisponível neste navegador'
    : `GPU ${ms(sample.gpuMs)} ms${pct === null ? '' : ` (${Math.round(pct)}% do quadro)`}`;
  return [
    `${fps(sample.fps)} fps · quadro ${ms(sample.frameMs)} ms`,
    `1% pior ${fps(sample.lowFps)} fps · pior quadro ${ms(sample.worstMs)} ms`,
    `CPU ${ms(sample.cpuMs)} ms · ${gpu}`,
    `Placa de vídeo: ${sample.gpuName ?? 'indisponível'}`,
    ...(sample.heapMb === null ? [] : [`Heap JS: ${sample.heapMb.toFixed(1)} MB`]),
    `Chamadas de desenho ${sample.calls} · triângulos ${sample.triangles}`,
    `Geometrias ${sample.geometries} · texturas ${sample.textures}`,
  ];
}
