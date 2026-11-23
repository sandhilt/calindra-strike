import { QUALITY_TIERS, type Quality } from '../game/render/quality.ts';

export type BenchmarkTier = Quality | 'high-no-rt';

export interface BenchmarkOptions {
  tiers: readonly BenchmarkTier[];
  maps: readonly string[];
  rounds: number;
  ms: number;
}

const DEFAULT_ROUNDS = 1;
const DEFAULT_MEASURE_MS = 3000;

function select<T extends string>(value: string | null, allowed: readonly T[], fallback = allowed): readonly T[] {
  if (value === null) return fallback;
  const selected = value.split(',').flatMap((item) => allowed.filter((id) => id === item.trim()));
  return selected.length ? [...new Set(selected)] : fallback;
}

function positiveInteger(value: string | null, fallback: number): number {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function localReport(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol === 'http:' || url.protocol === 'https:')
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      && !url.username && !url.password) return url.href;
  } catch {
    return null;
  }
  return null;
}

export function parseBenchmarkParams(search: string, mapIds: readonly string[]) {
  const params = new URLSearchParams(search);
  const allowedTiers: readonly BenchmarkTier[] = [...QUALITY_TIERS, 'high-no-rt'];
  const options: BenchmarkOptions = {
    tiers: select(params.get('tiers'), allowedTiers, QUALITY_TIERS),
    maps: select(params.get('maps'), mapIds),
    rounds: positiveInteger(params.get('rounds'), DEFAULT_ROUNDS),
    ms: positiveInteger(params.get('ms'), DEFAULT_MEASURE_MS),
  };
  return { enabled: params.has('benchmark'), options, report: localReport(params.get('report')) };
}
