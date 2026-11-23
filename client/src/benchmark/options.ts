import { QUALITY, QUALITY_TIERS, type Quality, type QualityProfile } from '../game/render/quality.ts';
import { DEFAULT_RT_LEVEL, type RtLevel } from '../game/render/rt-levels.ts';

/** The high tier with its light ray pass pinned to one level, so the harness can price each level. Left out of recommendations. */
export const RT_VARIANTS = {
  'high-no-rt': 'off',
  'high-rt-light': 'light',
  'high-rt-medium': 'medium',
  'high-rt-high': 'high',
} as const satisfies Record<string, RtLevel>;

export type RtVariant = keyof typeof RT_VARIANTS;
export type BenchmarkTier = Quality | RtVariant;

export const isRtVariant = (tier: BenchmarkTier): tier is RtVariant => tier in RT_VARIANTS;

/** What a benchmark tier runs: a quality profile and the ray pass level. Plain tiers use the level a player gets by default. */
export function benchmarkSetup(tier: BenchmarkTier): { profile: QualityProfile; rtLevel: RtLevel } {
  if (isRtVariant(tier)) return { profile: QUALITY.high, rtLevel: RT_VARIANTS[tier] };
  const profile = QUALITY[tier];
  return { profile, rtLevel: profile.lightRt ? DEFAULT_RT_LEVEL : 'off' };
}

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
  const allowedTiers: readonly BenchmarkTier[] = [...QUALITY_TIERS, ...(Object.keys(RT_VARIANTS) as RtVariant[])];
  const options: BenchmarkOptions = {
    tiers: select(params.get('tiers'), allowedTiers, QUALITY_TIERS),
    maps: select(params.get('maps'), mapIds),
    rounds: positiveInteger(params.get('rounds'), DEFAULT_ROUNDS),
    ms: positiveInteger(params.get('ms'), DEFAULT_MEASURE_MS),
  };
  return { enabled: params.has('benchmark'), options, report: localReport(params.get('report')) };
}
