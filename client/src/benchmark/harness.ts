import { getMaps } from '@calindra-strike/shared';
import { parseBenchmarkParams } from './options.ts';
import { runBenchmark, type BenchmarkResult } from './run.ts';

declare global {
  interface Window {
    __benchmark?: BenchmarkResult;
  }
}

export async function runBenchmarkHarness(app: HTMLElement): Promise<void> {
  const { options, report } = parseBenchmarkParams(location.search, getMaps().map(({ id }) => id));
  const canvas = document.createElement('div');
  canvas.className = 'benchmark-canvas';
  app.replaceChildren(canvas);
  const controller = new AbortController();
  const abort = () => controller.abort();
  window.addEventListener('pagehide', abort, { once: true });
  try {
    const result = await runBenchmark(canvas, options, controller.signal);
    const json = JSON.stringify(result);
    window.__benchmark = result;
    document.title = 'benchmark:done';
    console.info('[benchmark]', json);
    if (report) {
      void fetch(report, { method: 'POST', mode: 'no-cors', redirect: 'error', body: json })
        .catch((error: unknown) => console.warn('[benchmark] report failed', error));
    }
  } finally {
    window.removeEventListener('pagehide', abort);
    canvas.remove();
  }
}
