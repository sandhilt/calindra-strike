import { BRAND } from '../../brand.ts';
import type { AppName } from './apps.ts';
import { fillDisc, fillPolygon, fillRound, line, type Ctx, type Point } from './canvas.ts';

/** Icons are drawn in a 100x100 box; drawIcon scales that box to the requested size. */
type IconPainter = (c: Ctx) => void;

const LOGO_ICON_SRC = '/brand/logo-icon-512.png';

const images = new Map<string, HTMLImageElement>();

/** Loads each brand image once; the icon keeps its lettered fallback until the pixels arrive. */
function loadedImage(src: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let image = images.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    images.set(src, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function gradient(c: Ctx, from: string, to: string, x1 = 0, y1 = 0, x2 = 100, y2 = 100): CanvasGradient {
  const fill = c.createLinearGradient(x1, y1, x2, y2);
  fill.addColorStop(0, from);
  fill.addColorStop(1, to);
  return fill;
}

function tile(c: Ctx, fill: string | CanvasGradient, radius = 22): void {
  fillRound(c, 4, 4, 92, 92, radius, fill);
}

function stroked(c: Ctx, color: string, width: number, path: () => void): void {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  path();
  c.stroke();
  c.lineCap = 'butt';
  c.lineJoin = 'miter';
}

function filled(c: Ctx, fill: string | CanvasGradient, path: () => void): void {
  c.fillStyle = fill;
  c.beginPath();
  path();
  c.fill();
}

function hexagon(cx: number, cy: number, radius: number, rotation = -Math.PI / 2): Point[] {
  return Array.from({ length: 6 }, (_, i): Point => [cx + Math.cos(rotation + (i * Math.PI) / 3) * radius, cy + Math.sin(rotation + (i * Math.PI) / 3) * radius]);
}

function letter(c: Ctx, value: string, color: string, size = 54): void {
  c.fillStyle = color;
  c.font = `bold ${size}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(value, 50, 53);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
}

function lettered(background: string, foreground: string, value: string): IconPainter {
  return (c) => {
    tile(c, background);
    letter(c, value, foreground);
  };
}

function promptGlyph(c: Ctx, color: string, width = 8): void {
  stroked(c, color, width, () => {
    c.moveTo(26, 34);
    c.lineTo(46, 50);
    c.lineTo(26, 66);
  });
  line(c, 54, 68, 76, 68, color, width);
}

function terminalIcon(background: string, border: string, foreground: string): IconPainter {
  return (c) => {
    tile(c, background);
    c.strokeStyle = border;
    c.lineWidth = 4;
    c.beginPath();
    c.roundRect(6, 6, 88, 88, 20);
    c.stroke();
    promptGlyph(c, foreground);
  };
}

function brandTile(background: string, source: string, fallback: IconPainter): IconPainter {
  return (c) => {
    const image = loadedImage(source);
    if (!image) return fallback(c);
    tile(c, background);
    c.drawImage(image, 18, 20, 64, 60);
  };
}

const chrome: IconPainter = (c) => {
  const sectors: readonly (readonly [number, number, string])[] = [
    [210, 330, '#ea4335'],
    [330, 450, '#fbbc04'],
    [90, 210, '#34a853'],
  ];
  for (const [from, to, color] of sectors) {
    filled(c, color, () => {
      c.moveTo(50, 50);
      c.arc(50, 50, 46, (from * Math.PI) / 180, (to * Math.PI) / 180);
    });
  }
  fillDisc(c, 50, 50, 25, '#ffffff');
  fillDisc(c, 50, 50, 19, '#4285f4');
};

const firefox: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, gradient(c, '#ffb13d', '#ff4f3a', 70, 0, 20, 100));
  fillDisc(c, 50, 54, 33, gradient(c, '#9059ff', '#4a1d9e', 20, 20, 80, 90));
  fillDisc(c, 62, 40, 27, gradient(c, '#ff9a3c', '#ff6a3a', 40, 10, 80, 70));
  fillDisc(c, 46, 58, 17, '#4a1d9e');
  fillPolygon(c, [[74, 16], [88, 30], [70, 34]], '#ffd23f');
};

const edge: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, gradient(c, '#2f7df0', '#27d38a', 10, 20, 90, 90));
  stroked(c, '#0a4fa8', 14, () => {
    c.moveTo(24, 58);
    c.bezierCurveTo(30, 28, 76, 22, 80, 54);
  });
  fillDisc(c, 52, 64, 20, '#0d63c9');
  stroked(c, '#d8fff1', 7, () => {
    c.moveTo(34, 56);
    c.bezierCurveTo(38, 40, 66, 38, 68, 56);
  });
};

const vscode: IconPainter = (c) => {
  fillPolygon(c, [[66, 8], [88, 19], [88, 81], [66, 92], [30, 58], [14, 70], [14, 30], [30, 42]], '#1f9cf0');
  fillPolygon(c, [[66, 8], [88, 19], [88, 81], [66, 92], [50, 50]], '#0a6ebd');
  fillPolygon(c, [[30, 42], [14, 30], [14, 70], [30, 58], [42, 50]], '#2fb2ff');
};

const cursor: IconPainter = (c) => {
  tile(c, '#15130f');
  fillPolygon(c, [[50, 14], [80, 32], [50, 50], [20, 32]], '#f0f0f0');
  fillPolygon(c, [[20, 32], [50, 50], [50, 86], [20, 68]], '#9a9a9a');
  fillPolygon(c, [[50, 50], [80, 32], [80, 68], [50, 86]], '#545454');
};

const xcode: IconPainter = (c) => {
  tile(c, gradient(c, '#34a4ff', '#1650c8', 0, 0, 100, 100));
  c.save();
  c.translate(50, 50);
  c.rotate(-Math.PI / 4);
  fillRound(c, -6, -26, 12, 62, 4, '#f4f8ff');
  fillRound(c, -24, -32, 48, 18, 5, '#f4f8ff');
  c.restore();
};

const claudeCode: IconPainter = (c) => {
  tile(c, '#d97757');
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 + Math.PI / 8;
    line(c, 50 + Math.cos(angle) * 9, 50 + Math.sin(angle) * 9, 50 + Math.cos(angle) * 30, 50 + Math.sin(angle) * 30, '#fbeadf', 9);
  }
  fillDisc(c, 50, 50, 6, '#fbeadf');
};

const codex: IconPainter = (c) => {
  tile(c, '#10121a');
  for (let i = 0; i < 3; i++) {
    c.save();
    c.translate(50, 50);
    c.rotate((i * Math.PI) / 3);
    c.strokeStyle = i === 1 ? '#9fb4ff' : '#f4f6fb';
    c.lineWidth = 5.5;
    c.beginPath();
    c.roundRect(-14, -30, 28, 60, 14);
    c.stroke();
    c.restore();
  }
};

const gemini: IconPainter = (c) => {
  const fill = gradient(c, '#4285f4', '#d96570', 10, 90, 90, 10);
  filled(c, fill, () => {
    c.moveTo(50, 4);
    c.quadraticCurveTo(57, 43, 96, 50);
    c.quadraticCurveTo(57, 57, 50, 96);
    c.quadraticCurveTo(43, 57, 4, 50);
    c.quadraticCurveTo(43, 43, 50, 4);
  });
};

const grok: IconPainter = (c) => {
  tile(c, '#0b0b0d');
  c.strokeStyle = '#f5f5f5';
  c.lineWidth = 8;
  c.beginPath();
  c.arc(50, 50, 24, 0, Math.PI * 2);
  c.stroke();
  line(c, 22, 80, 78, 20, '#f5f5f5', 8);
};

const jira: IconPainter = (c) => {
  tile(c, '#2684ff');
  const layers: readonly (readonly [number, number])[] = [[30, 1], [48, 0.72], [66, 0.45]];
  for (const [y, alpha] of layers) {
    c.globalAlpha = alpha;
    fillPolygon(c, [[50, y - 16], [74, y], [50, y + 16], [26, y]], '#ffffff');
  }
  c.globalAlpha = 1;
};

const slack: IconPainter = (c) => {
  const bars: readonly (readonly [number, number, number, number, string])[] = [
    [38, 18, 38, 62, '#36c5f0'],
    [62, 38, 62, 82, '#2eb67d'],
    [38, 38, 82, 38, '#ecb22e'],
    [18, 62, 62, 62, '#e01e5a'],
  ];
  for (const [x1, y1, x2, y2, color] of bars) {
    c.strokeStyle = color;
    c.lineWidth = 13;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }
  c.lineCap = 'butt';
};

const spotify: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#1ed760');
  const arcs: readonly (readonly [number, number, number])[] = [[34, 26, 8], [49, 22, 7], [63, 18, 6]];
  for (const [y, half, width] of arcs) {
    stroked(c, '#0b1d12', width, () => {
      c.moveTo(50 - half - 10, y + 2);
      c.quadraticCurveTo(50, y - 12, 50 + half + 10, y + 2);
    });
  }
};

const netflix: IconPainter = (c) => {
  tile(c, '#141414');
  fillRound(c, 28, 16, 14, 68, 2, '#e50914');
  fillRound(c, 58, 16, 14, 68, 2, '#e50914');
  fillPolygon(c, [[28, 16], [42, 16], [72, 84], [58, 84]], '#b20710');
};

const googleCalendar: IconPainter = (c) => {
  tile(c, '#ffffff', 14);
  c.save();
  c.beginPath();
  c.roundRect(4, 4, 92, 92, 14);
  c.clip();
  c.fillStyle = '#4285f4';
  c.fillRect(4, 4, 92, 28);
  c.restore();
  fillDisc(c, 28, 18, 4, '#ffffff');
  fillDisc(c, 72, 18, 4, '#ffffff');
  c.fillStyle = '#1a56c4';
  c.font = 'bold 44px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('17', 50, 80);
  c.textAlign = 'left';
};

const googleWorkspace: IconPainter = (c) => {
  fillRound(c, 8, 8, 40, 40, 11, '#4285f4');
  fillRound(c, 52, 8, 40, 40, 11, '#ea4335');
  fillRound(c, 8, 52, 40, 40, 11, '#fbbc04');
  fillRound(c, 52, 52, 40, 40, 11, '#34a853');
};

const github: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#161b22');
  c.strokeStyle = '#f0f6fc';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(50, 50, 44, 0, Math.PI * 2);
  c.stroke();
  fillPolygon(c, [[27, 38], [31, 17], [46, 28]], '#f0f6fc');
  fillPolygon(c, [[73, 38], [69, 17], [54, 28]], '#f0f6fc');
  fillDisc(c, 50, 50, 25, '#f0f6fc');
  for (const x of [34, 50, 66]) fillDisc(c, x, 76, 7, '#f0f6fc');
  fillDisc(c, 41, 48, 3.5, '#161b22');
  fillDisc(c, 59, 48, 3.5, '#161b22');
};

const bitbucket: IconPainter = (c) => {
  fillPolygon(c, [[12, 18], [88, 18], [78, 82], [22, 82]], '#2684ff');
  fillPolygon(c, [[12, 18], [88, 18], [86, 30], [14, 30]], '#6aa9ff');
  fillPolygon(c, [[36, 52], [64, 52], [60, 74], [40, 74]], '#0a3d99');
};

const githubActions: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#2188ff');
  c.strokeStyle = '#d8ebff';
  c.lineWidth = 6;
  c.beginPath();
  c.arc(50, 50, 31, 0.6, Math.PI * 2 - 0.6);
  c.stroke();
  fillPolygon(c, [[40, 33], [70, 50], [40, 67]], '#ffffff');
};

const bitbucketPipelines: IconPainter = (c) => {
  tile(c, '#0052cc');
  for (const flip of [0, Math.PI]) {
    c.save();
    c.translate(50, 50);
    c.rotate(flip);
    stroked(c, '#ffffff', 7, () => c.arc(0, 0, 26, Math.PI * 1.1, Math.PI * 2.05));
    fillPolygon(c, [[20, 6], [36, 6], [28, 20]], '#ffffff');
    c.restore();
  }
};

const nodejs: IconPainter = (c) => {
  fillPolygon(c, hexagon(50, 50, 46), '#5fa04e');
  fillPolygon(c, hexagon(50, 50, 34), '#7cc65f');
  letter(c, 'JS', '#1c3a17', 34);
};

const x: IconPainter = (c) => {
  tile(c, '#000000');
  c.strokeStyle = '#3a3a3a';
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(6, 6, 88, 88, 20);
  c.stroke();
  line(c, 27, 24, 73, 76, '#ffffff', 9);
  line(c, 73, 24, 27, 76, '#ffffff', 4);
};

const windows: IconPainter = (c) => {
  const blue = gradient(c, '#4cc2ff', '#0a6cd6');
  for (const [x, y] of [[10, 10], [52, 10], [10, 52], [52, 52]] as const) fillRound(c, x, y, 38, 38, 5, blue);
};

const windowsTerminal: IconPainter = (c) => {
  tile(c, '#1c1c24');
  fillRound(c, 4, 4, 92, 20, 14, '#3c4eb8');
  fillRound(c, 4, 14, 92, 10, 0, '#3c4eb8');
  promptGlyph(c, '#ffffff', 7);
};

const powershell: IconPainter = (c) => {
  tile(c, gradient(c, '#3f7de0', '#1c3f8f'));
  stroked(c, '#ffffff', 9, () => {
    c.moveTo(30, 28);
    c.lineTo(58, 50);
    c.lineTo(30, 72);
  });
  line(c, 56, 74, 76, 74, '#ffffff', 8);
};

const wsl: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#2d2f3a');
  filled(c, '#f4f4f4', () => c.ellipse(50, 56, 25, 33, 0, 0, Math.PI * 2));
  filled(c, '#14151b', () => c.ellipse(50, 50, 21, 30, 0, 0, Math.PI * 2));
  filled(c, '#f4f4f4', () => c.ellipse(50, 60, 13, 22, 0, 0, Math.PI * 2));
  fillDisc(c, 43, 38, 4, '#ffffff');
  fillDisc(c, 57, 38, 4, '#ffffff');
  fillPolygon(c, [[44, 45], [56, 45], [50, 53]], '#ffb454');
  fillPolygon(c, [[30, 86], [46, 86], [42, 78]], '#ffb454');
  fillPolygon(c, [[70, 86], [54, 86], [58, 78]], '#ffb454');
};

const explorer: IconPainter = (c) => {
  fillRound(c, 8, 20, 40, 18, 6, '#e0a526');
  fillRound(c, 8, 28, 84, 56, 8, gradient(c, '#ffd966', '#f2b027', 0, 28, 0, 84));
  fillRound(c, 8, 42, 84, 42, 8, '#ffcc4d');
};

const ubuntu: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#e95420');
  c.strokeStyle = '#ffffff';
  c.lineWidth = 7;
  c.beginPath();
  c.arc(50, 50, 24, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + (i * Math.PI * 2) / 3 + Math.PI / 6;
    fillDisc(c, 50 + Math.cos(angle) * 24, 50 + Math.sin(angle) * 24, 9, '#ffffff');
    fillDisc(c, 50 + Math.cos(angle) * 24, 50 + Math.sin(angle) * 24, 5, '#e95420');
  }
};

const docker: IconPainter = (c) => {
  fillRound(c, 8, 50, 76, 28, 13, '#2496ed');
  fillPolygon(c, [[76, 54], [94, 42], [90, 66]], '#2496ed');
  for (const [x, y] of [[18, 36], [32, 36], [46, 36], [32, 24], [46, 24], [60, 36]] as const) fillRound(c, x, y, 12, 11, 2, '#8fd0ff');
  fillDisc(c, 70, 60, 3, '#ffffff');
};

const deepseek: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#4d6bfe');
  stroked(c, '#ffffff', 8, () => {
    c.moveTo(20, 56);
    c.bezierCurveTo(30, 28, 54, 26, 60, 46);
    c.bezierCurveTo(64, 58, 78, 52, 82, 40);
  });
  fillDisc(c, 62, 62, 5, '#ffffff');
  stroked(c, '#c9d3ff', 5, () => {
    c.moveTo(30, 72);
    c.quadraticCurveTo(52, 82, 74, 72);
  });
};

const qwen: IconPainter = (c) => {
  fillPolygon(c, hexagon(50, 50, 46), gradient(c, '#8b7bff', '#4b3bd6'));
  c.strokeStyle = '#ffffff';
  c.lineWidth = 8;
  c.beginPath();
  c.arc(47, 47, 17, 0, Math.PI * 2);
  c.stroke();
  line(c, 56, 56, 72, 72, '#ffffff', 8);
};

const kimi: IconPainter = (c) => {
  tile(c, '#14171d');
  stroked(c, '#ffffff', 9, () => {
    c.moveTo(34, 24);
    c.lineTo(34, 76);
    c.moveTo(66, 24);
    c.lineTo(38, 52);
    c.lineTo(68, 78);
  });
  fillDisc(c, 74, 26, 7, '#027aff');
};

export const ICONS: Readonly<Record<AppName, IconPainter>> = {
  Cursor: cursor,
  'VS Code': vscode,
  Xcode: xcode,
  'Claude Code': claudeCode,
  Codex: codex,
  Gemini: gemini,
  Grok: grok,
  iTerm2: terminalIcon('#0d0f10', '#3be37a', '#3be37a'),
  WezTerm: terminalIcon('#2a2040', '#9b6bff', '#d9c4ff'),
  'Windows Terminal': windowsTerminal,
  Chrome: chrome,
  Firefox: firefox,
  Edge: edge,
  Explorer: explorer,
  Jira: jira,
  Slack: slack,
  Spotify: spotify,
  Netflix: netflix,
  'GitHub Actions': githubActions,
  'Bitbucket Pipelines': bitbucketPipelines,
  GitHub: github,
  Bitbucket: bitbucket,
  X: x,
  'Google Calendar': googleCalendar,
  'Google Workspace': googleWorkspace,
  'Eitri Console': brandTile('#12150c', BRAND.eitri, lettered('#12150c', '#a6ff00', 'E')),
  'Eitri Matrix': brandTile('#a6ff00', BRAND.eitriDark, lettered('#a6ff00', '#12150c', 'M')),
  Calindra: (c) => {
    const image = loadedImage(LOGO_ICON_SRC);
    if (image) c.drawImage(image, 4, 4, 92, 92);
    else lettered('#15170f', '#b6ff1a', 'C')(c);
  },
  DeepSeek: deepseek,
  Qwen: qwen,
  Kimi: kimi,
  'Node.js': nodejs,
  PowerShell: powershell,
  WSL: wsl,
  Ubuntu: ubuntu,
  Docker: docker,
  Windows: windows,
};

/** Draws the app icon with its top-left corner at (x, y) and the given side length. */
export function drawIcon(c: Ctx, app: AppName, x: number, y: number, size: number): void {
  c.save();
  c.translate(x, y);
  c.scale(size / 100, size / 100);
  ICONS[app](c);
  c.restore();
}
