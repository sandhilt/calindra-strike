import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function buildCommit(): string {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit()) },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    assetsInlineLimit: 0, // keep fonts as files: the CSP disallows data: fonts
  },
});
