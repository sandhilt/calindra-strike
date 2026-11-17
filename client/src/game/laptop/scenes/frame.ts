import type { Ctx } from '../canvas.ts';
import type { OsName, Scene } from '../scenarios.ts';

/** Size of the window content area every scene lays out in. */
export const CONTENT_W = 640;
export const CONTENT_H = 314;

export interface SceneFrame {
  /** Scene content progress, 0 when the window appears and 1 at the end of the scene. */
  readonly p: number;
  readonly timeMs: number;
  readonly os: OsName;
}

export type SceneOf = { readonly [K in Scene['kind']]: Extract<Scene, { kind: K }> };

export type SceneRenderer<K extends Scene['kind']> = (c: Ctx, scene: SceneOf[K], frame: SceneFrame) => void;
