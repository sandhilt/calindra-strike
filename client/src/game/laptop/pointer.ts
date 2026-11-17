import type { AppName } from './apps.ts';
import { clamp01, easeOut, fillPolygon, lerp, span, unitHash, type Ctx, type Point } from './canvas.ts';
import { dockCenterOf, rectCenter, startButtonCenter, windowControlRect } from './chrome.ts';
import type { OsName } from './scenarios.ts';
import { SPLASH_END } from './timeline.ts';
import { toastAt, toastClickTarget } from './toasts.ts';

export interface PointerInput {
  readonly os: OsName;
  readonly scenarioId: string;
  readonly sceneIndex: number;
  readonly local: number;
  readonly timeMs: number;
  readonly apps: readonly AppName[];
  readonly launched: AppName;
}

interface Aim {
  readonly from: number;
  readonly to: number;
  readonly target: Point;
}

/** Scene where Windows shows the Snap Layouts hover and where the pointer sweeps the close button. */
export const SNAP_SCENE = 1;
const CLOSE_SWEEP_SCENE = 2;
export const SNAP_WINDOW = { from: 0.3, to: 0.56 } as const;
const CLOSE_SWEEP_WINDOW = { from: 0.5, to: 0.64 } as const;
export const START_MENU_SCENE = 0;
export const START_MENU_WINDOW = { from: 0, to: 0.2 } as const;

function bump(local: number, from: number, to: number): number {
  const rise = easeOut(span(local, from, from + (to - from) * 0.35));
  const fall = easeOut(span(local, from + (to - from) * 0.65, to));
  return clamp01(rise * (1 - fall));
}

function aimsFor(input: PointerInput): Aim[] {
  const { os, scenarioId, sceneIndex, apps, launched, local } = input;
  const aims: Aim[] = [];
  if (os === 'windows' && sceneIndex === START_MENU_SCENE) aims.push({ ...START_MENU_WINDOW, target: startButtonCenter(apps) });
  aims.push({ from: 0.02, to: SPLASH_END + 0.04, target: dockCenterOf(os, apps, launched) });
  if (os === 'windows' && sceneIndex === SNAP_SCENE) aims.push({ ...SNAP_WINDOW, target: rectCenter(windowControlRect(os, 'max')) });
  if (os === 'windows' && sceneIndex === CLOSE_SWEEP_SCENE) aims.push({ ...CLOSE_SWEEP_WINDOW, target: rectCenter(windowControlRect(os, 'close')) });
  const toast = toastAt(scenarioId, sceneIndex, local);
  const click = toast ? toastClickTarget(os, toast.plan.toast) : undefined;
  if (toast && click) {
    const length = toast.plan.to - toast.plan.from;
    aims.push({ from: toast.plan.from + length * 0.3, to: toast.plan.from + length * 0.9, target: click });
  }
  return aims;
}

/** Deterministic pointer: wanders over the window and keeps its appointments with the dock, the controls and the toasts. */
export function pointerAt(input: PointerInput): Point {
  const seed = unitHash(input.sceneIndex + input.scenarioId);
  let x = 460 + Math.sin(input.timeMs / 750 + seed * 6) * 100;
  let y = 270 + Math.cos(input.timeMs / 950 + seed * 6) * 65;
  for (const aim of aimsFor(input)) {
    const weight = bump(input.local, aim.from, aim.to);
    x = lerp(x, aim.target[0], weight);
    y = lerp(y, aim.target[1], weight);
  }
  return [x, y];
}

export function drawPointer(c: Ctx, [x, y]: Point): void {
  fillPolygon(c, [[x, y], [x + 4, y + 22], [x + 10, y + 15], [x + 21, y + 15]], '#ffffff');
  c.strokeStyle = '#18202a';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + 4, y + 22);
  c.lineTo(x + 10, y + 15);
  c.lineTo(x + 21, y + 15);
  c.closePath();
  c.stroke();
}
