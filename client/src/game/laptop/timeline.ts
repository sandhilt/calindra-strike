import { span } from './canvas.ts';

/** Share of each scene spent on the "app launching" splash before its window opens. */
export const SPLASH_END = 0.15;
/** Scene progress at which the window has finished its open animation. */
const WINDOW_OPEN_END = 0.23;

/** Whole-animation progress where the icon montage starts and where the green banner takes over. */
export const MONTAGE_START = 0.88;
export const BANNER_START = 0.925;

/** Progress of the splash alone, 0 at scene start and 1 when the window starts opening. */
export function splashProgress(local: number): number {
  return span(local, 0, SPLASH_END);
}

/** Progress of the scene content, 0 when the window appears and 1 at the end of the scene. */
export function contentProgress(local: number): number {
  return span(local, SPLASH_END, 1);
}

export function windowOpenProgress(local: number): number {
  return span(local, SPLASH_END, WINDOW_OPEN_END);
}
