import { QUALITY_TIERS, type Quality } from '../game/render/quality.ts';

const FRAME_BUDGET_MS = 1000 / 60;
const FRAME_BUDGET_TOLERANCE = 0.05;
const RECOMMENDATION_THRESHOLD_PCT = 90;

export function summarize(frameMs: readonly number[]) {
  const frames = frameMs.length;
  if (!frames) return { frames, fps: 0, medianMs: 0, p95Ms: 0, smoothPct: 0 };

  const sorted = frameMs.toSorted((a, b) => a - b);
  const totalMs = sorted.reduce((sum, ms) => sum + ms, 0);
  const smoothFrames = sorted.filter((ms) => ms <= FRAME_BUDGET_MS * (1 + FRAME_BUDGET_TOLERANCE)).length;
  const median = (sorted[Math.floor((frames - 1) / 2)] + sorted[Math.floor(frames / 2)]) / 2;
  return {
    frames,
    fps: totalMs > 0 ? Math.round(frames * 10000 / totalMs) / 10 : 0,
    medianMs: Math.round(median * 100) / 100,
    p95Ms: Math.round(sorted[Math.ceil(frames * 0.95) - 1] * 100) / 100,
    smoothPct: Math.round(100 * smoothFrames / frames),
  };
}

export type FrameSummary = ReturnType<typeof summarize>;

export function recommend<Summary extends FrameSummary>(perTier: Partial<Record<Quality, Summary>>) {
  const tiers = QUALITY_TIERS.flatMap((tier) => {
    const summary = perTier[tier];
    return summary ? [{ tier, ...summary }] : [];
  });
  const choice = tiers.find(({ smoothPct }) => smoothPct >= RECOMMENDATION_THRESHOLD_PCT)
    ?? tiers.toSorted((a, b) => b.smoothPct - a.smoothPct)[0];
  return choice ? { tier: choice.tier, percent: choice.smoothPct, tiers } : null;
}
