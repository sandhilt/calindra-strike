import { SCENARIOS } from './game/laptop/scenarios.ts';
import { drawLaptop, drawIdleScreen } from './game/laptop/draw.ts';
const style = document.createElement('style');
style.textContent = `body{margin:0;background:#0c1320;color:#dce8f7;font:16px system-ui}main{max-width:1500px;margin:auto;padding:28px}h1{margin-bottom:6px}p{color:#a0b6d0}#controls{position:sticky;top:0;background:#182539;padding:16px;border-radius:12px;z-index:1}input{width: min(55vw,600px);vertical-align:middle}button{background:#80e5c2;border:0;padding:9px 20px;border-radius:6px;margin-right:20px}#scenarios{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:24px}canvas{width:100%;max-width:720px;background:#101c2d;border-radius:12px}h2{font-size:18px}`;
document.head.append(style);
const container = document.querySelector('#scenarios');
const slider = document.querySelector<HTMLInputElement>('#progress');
const play = document.querySelector<HTMLButtonElement>('#play');
const idle = document.querySelector<HTMLCanvasElement>('#idle')?.getContext('2d');
const contexts = SCENARIOS.map(scenario => {
  const card = document.createElement('section'); const title = document.createElement('h2'); title.textContent = scenario.title;
  const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 460; canvas.setAttribute('aria-label', scenario.title);
  card.append(title, canvas); container?.append(card); return canvas.getContext('2d');
});
let playing = true, progress = 0, previous: number | undefined;
slider?.addEventListener('input', () => { progress = Number(slider.value); playing = false; if (play) play.textContent = 'Retomar'; });
play?.addEventListener('click', () => { playing = !playing; play.textContent = playing ? 'Pausar' : 'Retomar'; });
function frame(time: number): void {
  if (playing) progress = (progress + (previous === undefined ? 0 : time - previous) / 8000) % 1;
  previous = time; if (slider) slider.value = String(progress);
  contexts.forEach((ctx, index) => { if (ctx) drawLaptop(ctx, 720, 460, index, progress, time); });
  if (idle) drawIdleScreen(idle, 720, 460, 0, 40 - progress * 40, time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
