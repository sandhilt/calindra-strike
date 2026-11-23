const QUERY_POOL_SIZE = 4;
const NS_PER_MS = 1_000_000;

export function medianTiming(samples: readonly number[]): number | null {
  if (!samples.length) return null;
  const sorted = samples.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2;
  return Math.round(median * 100) / 100;
}

export function createGpuTimer(gl: WebGL2RenderingContext) {
  const ext: unknown = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext || typeof ext !== 'object'
    || !('TIME_ELAPSED_EXT' in ext) || typeof ext.TIME_ELAPSED_EXT !== 'number'
    || !('GPU_DISJOINT_EXT' in ext) || typeof ext.GPU_DISJOINT_EXT !== 'number') return null;
  const { TIME_ELAPSED_EXT: elapsed, GPU_DISJOINT_EXT: disjoint } = ext;
  const pool: WebGLQuery[] = [];
  const pending: WebGLQuery[] = [];
  function discardPending() {
    for (const query of pending.splice(0)) gl.deleteQuery(query);
  }
  return {
    discardPending,
    begin() {
      const query = pool.pop() ?? (pending.length < QUERY_POOL_SIZE ? gl.createQuery() : null);
      if (query) gl.beginQuery(elapsed, query);
      return query;
    },
    end(query: WebGLQuery | null) {
      if (!query) return;
      gl.endQuery(elapsed);
      pending.push(query);
    },
    poll(samples: number[]) {
      if (gl.getParameter(disjoint)) {
        discardPending();
        return;
      }
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = pending[0];
        pending.shift();
        const ns: unknown = gl.getQueryParameter(query, gl.QUERY_RESULT);
        if (typeof ns === 'number' && Number.isFinite(ns) && ns >= 0) samples.push(ns / NS_PER_MS);
        pool.push(query);
      }
    },
    dispose() {
      for (const query of [...pending, ...pool]) gl.deleteQuery(query);
    },
  };
}
