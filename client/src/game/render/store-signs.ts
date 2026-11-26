import type { StoreBrand } from '@calindra-strike/shared';
import * as THREE from 'three';
import { canvasTexture } from './textures.ts';

const W = 512;
const H = 256;

type G = CanvasRenderingContext2D;

function panel(g: G, color: string): void {
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
}

/** Text centred on (x, y), shrunk until it fits `maxW`. */
function label(g: G, text: string, x: number, y: number, size: number, color: string, font = 'Arial Black, Arial, sans-serif', maxW = W - 40, style = ''): void {
  let s = size;
  do {
    g.font = `${style} ${s}px ${font}`;
    s -= 2;
  } while (g.measureText(text).width > maxW && s > 10);
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

function outlined(g: G, text: string, x: number, y: number, size: number, fill: string, stroke: string, font: string, maxW = W - 40, style = ''): void {
  label(g, text, x, y, size, fill, font, maxW, style);
  g.lineWidth = Math.max(3, size / 14);
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillText(text, x, y);
}

const SERIF = 'Georgia, "Times New Roman", serif';

/** A level sign: a coloured badge with the floor's letter or number, its name and what is up there. */
function floorSign(g: G, badge: string, name: string, caption: string, color: string): void {
  panel(g, '#f4f4f2');
  g.fillStyle = color;
  g.fillRect(0, 0, 150, H);
  label(g, badge, 75, H / 2, 150, '#ffffff', 'Arial Black, Arial, sans-serif', 110);
  label(g, name, 150 + (W - 150) / 2, 96, 70, '#1d2330', 'Arial Black, Arial, sans-serif', W - 190);
  g.fillStyle = color;
  g.fillRect(180, 142, W - 210, 4);
  label(g, caption, 150 + (W - 150) / 2, 190, 26, '#3a4150', 'Arial, sans-serif', W - 190, 'bold');
}

const SIGNS: Record<StoreBrand, (g: G) => void> = {
  kfg(g) {
    panel(g, '#ffffff');
    g.fillStyle = '#c8102e';
    for (let i = 0; i < 4; i++) g.fillRect(24 + i * 44, 0, 26, H);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(110, 120, 62, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1b1b1b';
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = '#1b1b1b';
    for (const ex of [88, 132]) {
      g.beginPath();
      g.arc(ex, 108, 14, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(96, 150);
    g.quadraticCurveTo(110, 184, 124, 150);
    g.fill();
    g.beginPath();
    g.moveTo(80, 198);
    g.lineTo(110, 186);
    g.lineTo(80, 174);
    g.moveTo(140, 198);
    g.lineTo(110, 186);
    g.lineTo(140, 174);
    g.fill();
    outlined(g, 'KFG', 360, 116, 150, '#c8102e', '#ffffff', 'Arial Black, Arial, sans-serif', 300, 'italic');
    label(g, 'Kentucky Frango Gostoso', 360, 210, 28, '#1b1b1b', 'Arial, sans-serif', 300, 'bold');
  },
  'burguer-rei'(g) {
    panel(g, '#f5ebdc');
    g.strokeStyle = '#1f5fbf';
    g.lineWidth = 18;
    g.beginPath();
    g.ellipse(W / 2, H / 2, 230, 112, 0, Math.PI * 0.15, Math.PI * 1.35);
    g.stroke();
    g.fillStyle = '#f5a623';
    g.beginPath();
    g.ellipse(W / 2, 92, 190, 64, 0, Math.PI, 0);
    g.fill();
    g.beginPath();
    g.ellipse(W / 2, 168, 190, 40, 0, 0, Math.PI);
    g.fill();
    outlined(g, 'BURGUER REI', W / 2, 130, 70, '#d62300', '#502314', 'Arial Black, Arial, sans-serif', 400);
  },
  'mania-picanha'(g) {
    panel(g, '#141414');
    g.fillStyle = '#e0261b';
    g.beginPath();
    g.moveTo(40, 220);
    for (let i = 0; i <= 8; i++) g.lineTo(40 + i * 54, i % 2 ? 150 : 200);
    g.lineTo(472, 220);
    g.fill();
    label(g, 'MANIA DE', W / 2, 64, 56, '#ffffff');
    label(g, 'PICANHA', W / 2, 136, 92, '#ffb400');
  },
  parrilha(g) {
    panel(g, '#3b2416');
    g.strokeStyle = '#d4a24c';
    g.lineWidth = 6;
    g.strokeRect(16, 16, W - 32, H - 32);
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(120 + i * 54, 188);
      g.lineTo(120 + i * 54, 220);
      g.stroke();
    }
    label(g, 'Parrilha', W / 2, 96, 96, '#d4a24c', SERIF, W - 60, 'italic bold');
    label(g, 'DO SUL · CARNES NA BRASA', W / 2, 166, 26, '#f3e3c3', 'Arial, sans-serif', W - 80, 'bold');
  },
  mequi(g) {
    panel(g, '#da291c');
    g.strokeStyle = '#ffc72c';
    g.lineWidth = 30;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(70, 210);
    g.bezierCurveTo(70, 20, 170, 20, 170, 210);
    g.moveTo(170, 210);
    g.bezierCurveTo(170, 20, 270, 20, 270, 210);
    g.stroke();
    label(g, 'Méqui', 390, 128, 84, '#ffffff', 'Arial Black, Arial, sans-serif', 220);
  },
  outbaque(g) {
    panel(g, '#5a1a12');
    g.strokeStyle = '#e8c47a';
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(60, 200);
    g.quadraticCurveTo(110, 120, 60, 60);
    g.stroke();
    label(g, 'Outbaque', 285, 104, 92, '#f4e2b8', SERIF, 380, 'italic bold');
    label(g, 'STEAKHOUSE', 285, 186, 34, '#e8c47a', 'Arial, sans-serif', 380, 'bold');
  },
  madeiro(g) {
    panel(g, '#121212');
    label(g, 'MADEIRO', W / 2, 104, 104, '#ffffff', SERIF, W - 50, 'bold');
    g.fillStyle = '#c4161c';
    g.fillRect(80, 160, W - 160, 6);
    label(g, 'o burger mais gostoso do escritório', W / 2, 200, 24, '#d9d9d9', 'Arial, sans-serif', W - 60, 'italic');
  },
  bobis(g) {
    panel(g, '#ffffff');
    g.fillStyle = '#e30613';
    g.fillRect(0, 0, W, 28);
    g.fillRect(0, H - 28, W, 28);
    outlined(g, "Bobo's", W / 2, 128, 130, '#e30613', '#1b1b1b', SERIF, W - 60, 'italic bold');
  },
  zarra(g) {
    panel(g, '#f7f7f5');
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(1.3, 1);
    label(g, 'ZARRA', 0, 6, 120, '#111111', 'Didot, "Bodoni MT", ' + SERIF, 340);
    g.restore();
  },
  cea(g) {
    panel(g, '#0050a0');
    label(g, 'C&Á', W / 2, 132, 150, '#ffffff', 'Arial Black, Arial, sans-serif', W - 80);
  },
  rener(g) {
    panel(g, '#2b2b2b');
    label(g, 'Rener', W / 2, 128, 130, '#ffffff', SERIF, W - 80, 'bold');
  },
  hew(g) {
    panel(g, '#e50010');
    label(g, 'H&W', W / 2, 132, 150, '#ffffff', 'Brush Script MT, ' + SERIF, W - 80, 'italic bold');
  },
  'cacau-chou'(g) {
    panel(g, '#4a2513');
    label(g, 'Cacau Chou', W / 2, 112, 92, '#e9c27a', 'Brush Script MT, ' + SERIF, W - 50, 'italic bold');
    label(g, 'CHOCOLATES', W / 2, 196, 30, '#f5e6c8', 'Arial, sans-serif', W - 80, 'bold');
  },
  amerikanas(g) {
    panel(g, '#e60014');
    label(g, 'amerikanas', W / 2, 128, 96, '#ffffff', 'Arial Black, Arial, sans-serif', W - 50);
  },
  riachuela(g) {
    panel(g, '#ffffff');
    label(g, 'RIACHUELA', W / 2, 116, 84, '#1c2a5a', 'Arial Black, Arial, sans-serif', W - 50);
    g.fillStyle = '#c9a227';
    g.fillRect(120, 176, W - 240, 8);
  },
  'droga-raio'(g) {
    panel(g, '#d8202a');
    label(g, 'Droga Raio', W / 2, 112, 92, '#ffffff', 'Arial Black, Arial, sans-serif', W - 50);
    label(g, 'FARMÁCIA', W / 2, 192, 34, '#ffe9e9', 'Arial, sans-serif', W - 80, 'bold');
  },
  'pague-pouco'(g) {
    panel(g, '#1f4fa8');
    label(g, 'Pague Pouco', W / 2, 108, 84, '#f2c200', 'Arial Black, Arial, sans-serif', W - 50);
    label(g, 'FARMÁCIA', W / 2, 190, 34, '#ffffff', 'Arial, sans-serif', W - 80, 'bold');
  },
  travessura(g) {
    panel(g, '#1f3d2b');
    label(g, 'Livraria da', W / 2, 78, 48, '#efe6cf', SERIF, W - 60, 'italic');
    label(g, 'Travessura', W / 2, 158, 92, '#efe6cf', SERIF, W - 60, 'bold');
  },
  samsong(g) {
    panel(g, '#ffffff');
    g.fillStyle = '#1428a0';
    g.save();
    g.translate(W / 2, H / 2 - 12);
    g.rotate(-0.07);
    g.beginPath();
    g.ellipse(0, 0, 232, 88, 0, 0, Math.PI * 2);
    g.fill();
    g.scale(1.3, 1);
    label(g, 'SEMSUNGA', 0, 3, 74, '#ffffff', 'Arial Black, Arial, sans-serif', 300);
    g.restore();
    label(g, 'ELETRÔNICOS · CELULARES · TABLETS', W / 2, 228, 22, '#1428a0', 'Arial, sans-serif', W - 80, 'bold');
  },
  'ray-bao'(g) {
    panel(g, '#161616');
    g.fillStyle = '#d71f26';
    g.beginPath();
    g.ellipse(W / 2, H / 2, 232, 92, 0, 0, Math.PI * 2);
    g.fill();
    label(g, 'Ray-Bão', W / 2, H / 2 + 4, 104, '#ffffff', 'Brush Script MT, ' + SERIF, 380, 'italic bold');
  },
  pandorga(g) {
    panel(g, '#ffffff');
    label(g, 'pandorga', W / 2, 112, 96, '#2b2b2b', SERIF, W - 80, 'bold');
    g.fillStyle = '#e77aa6';
    g.beginPath();
    g.arc(W / 2 + 9, 52, 12, 0, Math.PI * 2);
    g.fill();
    label(g, 'JOIAS E CHARMS', W / 2, 192, 30, '#8d8d8d', 'Arial, sans-serif', W - 120, 'bold');
  },
  'pe-leve'(g) {
    panel(g, '#1f3d2b');
    label(g, 'Pé Leve', W / 2, 104, 104, '#f4e3b0', SERIF, W - 60, 'italic bold');
    label(g, 'CALÇADOS', W / 2, 196, 32, '#f4e3b0', 'Arial, sans-serif', W - 120, 'bold');
  },
  essencia(g) {
    panel(g, '#f3e6ef');
    label(g, 'Essência', W / 2, 104, 100, '#7a2f5a', SERIF, W - 60, 'italic bold');
    label(g, 'PERFUMARIA', W / 2, 196, 30, '#7a2f5a', 'Arial, sans-serif', W - 120, 'bold');
  },
  sentauro(g) {
    panel(g, '#e4002b');
    g.fillStyle = '#161616';
    g.fillRect(0, 186, W, 22);
    label(g, 'SENTAURO', W / 2, 108, 100, '#ffffff', 'Arial Black, Arial, sans-serif', W - 50, 'italic');
    label(g, 'ESPORTES', W / 2, 226, 26, '#ffffff', 'Arial, sans-serif', W - 120, 'bold');
  },
  'brinco-center'(g) {
    panel(g, '#ffd400');
    const text = 'BRINCO';
    const colors = ['#e4002b', '#1f6fd1', '#2f9e44', '#e4002b', '#1f6fd1', '#2f9e44'];
    g.font = 'bold 116px Arial Black, Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const widths = [...text].map((c) => g.measureText(c).width);
    let x = (W - widths.reduce((a, b) => a + b, 0)) / 2;
    [...text].forEach((c, i) => {
      g.fillStyle = colors[i];
      g.fillText(c, x, 100);
      x += widths[i];
    });
    label(g, 'CENTER', W / 2, 200, 56, '#161616', 'Arial Black, Arial, sans-serif', W - 160);
  },
  loccitano(g) {
    panel(g, '#f2c200');
    label(g, "L'OCCITANO", W / 2, 100, 80, '#1c3a6b', SERIF, W - 50, 'bold');
    g.fillStyle = '#1c3a6b';
    g.fillRect(70, 152, W - 140, 4);
    label(g, 'EM PROVENÇA', W / 2, 196, 34, '#1c3a6b', SERIF, W - 120, 'italic');
  },
  'piso-terreo'(g) {
    floorSign(g, 'T', 'TÉRREO', 'LOJAS · ATRIO · FONTE', '#1b4d8f');
  },
  'piso-1'(g) {
    floorSign(g, '1', '1º ANDAR', 'PRAÇA DE ALIMENTAÇÃO', '#c8102e');
  },
  'piso-mirante'(g) {
    floorSign(g, 'M', 'MIRANTE', 'BOUTIQUES · CAFÉ · VISTA', '#2f7d4f');
  },
};

/** The sign drawn on a plain canvas, for the 2D logo of a banner. */
export function signCanvas(brand: StoreBrand): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (g) SIGNS[brand](g);
  return canvas;
}

/** Lit sign material so the logo reads in the shade under the food court. */
export function signMaterial(brand: StoreBrand): THREE.Material {
  const t = canvasTexture(W, (g) => SIGNS[brand](g), false, W, H);
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.5 });
}
