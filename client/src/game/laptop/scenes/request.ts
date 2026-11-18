import { APP_ACCENT } from '../apps.ts';
import { fillRound, line, write } from '../canvas.ts';
import { CONTENT_H, CONTENT_W, type SceneRenderer } from './frame.ts';
import { MUTED, statusMark } from './widgets.ts';

const SEND_AT = 0.24;
const RESPONSE_AT = 0.48;

export const drawRequest: SceneRenderer<'request'> = (c, scene, { p, timeMs }) => {
  const orange = APP_ACCENT[scene.app];
  c.fillStyle = '#212121';
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  write(c, 'Coleções   /   Sessão', 18, 29, { color: MUTED, size: 14 });
  fillRound(c, 16, 45, 505, 40, 6, '#303030');
  write(c, 'GET', 29, 71, { color: '#65d39c', size: 16, weight: 'bold' });
  line(c, 80, 53, 80, 77, '#525252');
  write(c, scene.url, 94, 71, { color: '#f2f2f2', size: 15, mono: true });
  fillRound(c, 532, 45, 92, 40, 6, p >= SEND_AT && p < RESPONSE_AT ? '#944126' : orange);
  write(c, 'Send', 557, 71, { color: '#21130e', size: 16, weight: 'bold' });
  write(c, 'Params     Authorization     Headers     Body', 18, 114, { color: MUTED, size: 14 });
  line(c, 16, 127, 624, 127, '#424242');
  write(c, 'Resposta', 18, 156, { color: '#f2f2f2', size: 16, weight: 'bold' });

  if (p < SEND_AT) return;
  if (p < RESPONSE_AT) {
    statusMark(c, 23, 184, 'running', timeMs, 6);
    write(c, 'Enviando requisição…', 38, 190, { color: MUTED, size: 15 });
    return;
  }

  fillRound(c, 390, 136, 234, 28, 5, '#482824');
  write(c, '500 Internal Server Error', 401, 155, { color: '#ffaaa0', size: 14, mono: true });
  fillRound(c, 16, 178, 608, 120, 6, '#191919');
  JSON.stringify(scene.response, null, 2).split('\n').forEach((row, index) => {
    const y = 201 + index * 24;
    write(c, String(index + 1), 30, y, { color: MUTED, size: 14, mono: true });
    write(c, row, 55, y, { color: '#f4c29d', size: 15, mono: true });
  });
};
