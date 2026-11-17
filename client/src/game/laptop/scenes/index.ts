import type { Ctx } from '../canvas.ts';
import type { Scene } from '../scenarios.ts';
import { drawBrowser } from './browser.ts';
import { drawAgent, drawEditor } from './editor.ts';
import { drawFiles } from './files.ts';
import type { SceneFrame, SceneOf, SceneRenderer } from './frame.ts';
import { drawTerminal } from './terminal.ts';
import { drawBoard, drawChat, drawMedia, drawPipeline } from './workspace.ts';

type RendererTable = { readonly [K in Scene['kind']]: SceneRenderer<K> };

/** One renderer per scene kind; the compiler rejects a kind without one. */
const RENDERERS: RendererTable = {
  editor: drawEditor,
  agent: drawAgent,
  terminal: drawTerminal,
  browser: drawBrowser,
  files: drawFiles,
  board: drawBoard,
  chat: drawChat,
  media: drawMedia,
  pipeline: drawPipeline,
};

function drawAs<K extends Scene['kind']>(c: Ctx, kind: K, scene: SceneOf[K], frame: SceneFrame): void {
  RENDERERS[kind](c, scene, frame);
}

export function drawScene(c: Ctx, scene: Scene, frame: SceneFrame): void {
  drawAs(c, scene.kind, scene, frame);
}
