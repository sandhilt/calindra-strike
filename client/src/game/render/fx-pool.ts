/** Index of the body that has lived longest, or -1 when the pool is empty. */
export function oldestIndex(bodies: readonly { age: number }[], live: number): number {
  let best = -1;
  let bestAge = -1;
  for (let i = 0; i < live; i++) {
    if (bodies[i].age > bestAge) {
      bestAge = bodies[i].age;
      best = i;
    }
  }
  return best;
}

/** Removes bodies[index] by swapping the last live body into its place. Returns the new live count. */
export function swapRemove<T>(bodies: T[], index: number, live: number): number {
  const last = live - 1;
  const gone = bodies[index];
  bodies[index] = bodies[last];
  bodies[last] = gone;
  return last;
}
