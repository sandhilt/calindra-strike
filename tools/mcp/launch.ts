import { registerHooks } from 'node:module';

// The server sources import the shared package by its workspace name, which only resolves after
// npm install. A plugin is copied without node_modules, so point that one specifier at the sources.
const sharedEntry = new URL('../../shared/src/index.ts', import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@calindra-strike/shared') return { url: sharedEntry, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

await import('./index.ts');
