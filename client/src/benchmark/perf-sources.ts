export function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string | null {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
}

export function heapMb(): number | null {
  if (!('memory' in performance)) return null;
  const memory = performance.memory;
  return memory && typeof memory === 'object' && 'usedJSHeapSize' in memory
    && typeof memory.usedJSHeapSize === 'number' ? memory.usedJSHeapSize / (1024 * 1024) : null;
}
