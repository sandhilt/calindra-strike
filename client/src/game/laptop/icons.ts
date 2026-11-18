import { BRAND } from '../../brand.ts';
import { APP_ACCENT, type AppName } from './apps.ts';
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
  // Each slice ends on a tangent to the central disc.
  const sectors: readonly (readonly [number, Point, Point, string])[] = [
    [210, [50, 26], [29, 62], '#ea4335'],
    [330, [71, 62], [50, 26], '#fbbc05'],
    [90, [29, 62], [71, 62], '#34a853'],
  ];
  for (const [angle, first, second, color] of sectors) {
    filled(c, color, () => {
      c.arc(50, 50, 46, angle * Math.PI / 180, (angle + 120) * Math.PI / 180);
      c.lineTo(...first);
      c.lineTo(...second);
      c.closePath();
    });
  }
  fillDisc(c, 50, 50, 24, '#ffffff');
  fillDisc(c, 50, 50, 20.5, '#4285f4');
};

const firefox: IconPainter = (c) => {
  fillDisc(c, 50, 52, 42, gradient(c, '#9059ff', '#32118f', 80, 12, 23, 90));
  filled(c, gradient(c, '#ffdb3b', '#ff285e', 77, 6, 26, 88), () => {
    c.moveTo(76, 6);
    c.bezierCurveTo(78, 24, 95, 28, 96, 52);
    c.bezierCurveTo(99, 76, 80, 96, 54, 96);
    c.bezierCurveTo(22, 97, 4, 78, 5, 54);
    c.bezierCurveTo(5, 39, 10, 30, 17, 28);
    c.quadraticCurveTo(17, 17, 26, 13);
    c.quadraticCurveTo(27, 23, 32, 30);
    c.quadraticCurveTo(38, 27, 48, 30);
    c.quadraticCurveTo(40, 37, 43, 42);
    c.quadraticCurveTo(53, 44, 59, 50);
    c.bezierCurveTo(48, 58, 46, 49, 37, 57);
    c.bezierCurveTo(30, 68, 44, 81, 58, 77);
    c.bezierCurveTo(77, 73, 82, 52, 72, 40);
    c.bezierCurveTo(58, 24, 67, 12, 76, 6);
    c.closePath();
  });
  filled(c, gradient(c, '#fff16a', '#ff6b24', 86, 12, 67, 80), () => {
    c.moveTo(76, 6);
    c.bezierCurveTo(76, 23, 92, 30, 94, 49);
    c.bezierCurveTo(96, 64, 89, 76, 74, 84);
    c.bezierCurveTo(87, 61, 80, 46, 72, 36);
    c.bezierCurveTo(64, 25, 67, 13, 76, 6);
  });
};

const edge: IconPainter = (c) => {
  filled(c, gradient(c, '#0053ad', '#23b8e5', 18, 26, 80, 90), () => {
    c.moveTo(92, 79);
    c.bezierCurveTo(75, 100, 40, 103, 21, 83);
    c.bezierCurveTo(3, 66, 10, 40, 28, 32);
    c.bezierCurveTo(43, 25, 68, 35, 65, 53);
    c.bezierCurveTo(60, 44, 47, 46, 44, 56);
    c.bezierCurveTo(37, 75, 67, 91, 92, 79);
  });
  filled(c, gradient(c, '#22cf84', '#12a9e1', 78, 15, 18, 67), () => {
    c.moveTo(6, 63);
    c.bezierCurveTo(-2, 32, 20, 5, 52, 5);
    c.bezierCurveTo(78, 5, 96, 22, 96, 43);
    c.bezierCurveTo(96, 56, 79, 65, 62, 57);
    c.bezierCurveTo(73, 48, 62, 31, 45, 32);
    c.bezierCurveTo(27, 31, 11, 43, 6, 63);
  });
};

const vscode: IconPainter = (c) => {
  fillPolygon(c, [[10, 29], [20, 24], [72, 65], [72, 88], [10, 39]], '#007acc');
  fillPolygon(c, [[10, 62], [20, 69], [72, 29], [72, 7], [10, 54]], '#1f9cf0');
  fillPolygon(c, [[72, 7], [92, 16], [92, 83], [72, 93]], gradient(c, '#32b6fa', '#1389df', 72, 7, 92, 93));
};

const cursor: IconPainter = (c) => {
  tile(c, '#161616');
  fillPolygon(c, [[50, 11], [84, 30], [50, 49], [16, 30]], gradient(c, '#fff', '#b2b2b2', 25, 12, 77, 41));
  fillPolygon(c, [[16, 30], [50, 49], [50, 88], [16, 69]], gradient(c, '#bbb', '#414141', 15, 34, 48, 88));
  fillPolygon(c, [[50, 49], [84, 30], [84, 69], [50, 88]], '#333333');
  fillPolygon(c, [[50, 49], [84, 30], [50, 88]], '#ffffff');
};

const xcode: IconPainter = (c) => {
  tile(c, gradient(c, '#49bdff', '#0758d9', 0, 0, 38, 100));
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(46, 53, 31, 0, Math.PI * 2);
  c.stroke();
  for (const x of [29, 46, 63]) line(c, x, 20, x, 85, 'rgba(255,255,255,0.24)');
  line(c, 16, 68, 76, 68, '#e1f4ff', 3);
  line(c, 24, 78, 48, 34, '#e1f4ff', 3);
  line(c, 64, 78, 42, 35, '#e1f4ff', 3);
  c.save();
  c.translate(64, 48);
  c.rotate(Math.PI / 5);
  fillRound(c, -5, -11, 10, 51, 4, gradient(c, '#8c99a8', '#353c45', -5, 0, 5, 0));
  fillRound(c, -6, 15, 12, 29, 4, '#30343a');
  fillPolygon(c, [[-22, -19], [-12, -25], [12, -25], [22, -20], [22, -11], [9, -12], [-5, -12], [-16, -8], [-23, -9]], gradient(c, '#f8fcff', '#738494', 0, -25, 0, -9));
  c.restore();
};

const claudeCode: IconPainter = (c) => {
  tile(c, '#d97757');
  const rays: readonly (readonly [number, number])[] = [
    [49, 17], [63, 23], [78, 25], [83, 39], [85, 53], [77, 68],
    [69, 79], [53, 84], [39, 78], [25, 75], [16, 60], [21, 45], [23, 29],
  ];
  for (const [x, y] of rays) {
    stroked(c, '#fff5ed', 6, () => {
      c.moveTo(50, 50);
      c.quadraticCurveTo((x + 50) / 2 + 2, (y + 50) / 2 - 2, x, y);
    });
  }
};

const codex: IconPainter = (c) => {
  tile(c, gradient(c, '#24213c', '#10101c'));
  filled(c, gradient(c, '#b2aeff', '#6760e2', 20, 12, 80, 90), () => {
    c.moveTo(26, 73);
    c.bezierCurveTo(8, 71, 9, 46, 25, 42);
    c.bezierCurveTo(24, 21, 53, 14, 66, 32);
    c.bezierCurveTo(83, 28, 91, 42, 87, 54);
    c.bezierCurveTo(94, 66, 84, 79, 70, 78);
    c.lineTo(30, 78);
    c.quadraticCurveTo(27, 77, 26, 73);
  });
  stroked(c, '#221e43', 5, () => {
    c.moveTo(35, 45);
    c.lineTo(47, 54);
    c.lineTo(35, 63);
    c.moveTo(54, 63);
    c.lineTo(67, 63);
  });
};

const gemini: IconPainter = (c) => {
  const fill = c.createLinearGradient(6, 94, 94, 4);
  fill.addColorStop(0, '#4285f4');
  fill.addColorStop(0.45, '#4285f4');
  fill.addColorStop(0.67, '#34a853');
  fill.addColorStop(0.82, '#fbbc05');
  fill.addColorStop(1, '#ea4335');
  filled(c, fill, () => {
    c.moveTo(50, 4);
    c.bezierCurveTo(54, 30, 70, 46, 96, 50);
    c.bezierCurveTo(70, 54, 54, 70, 50, 96);
    c.bezierCurveTo(46, 70, 30, 54, 4, 50);
    c.bezierCurveTo(30, 46, 46, 30, 50, 4);
  });
};

const grok: IconPainter = (c) => {
  tile(c, '#0b0b0d');
  filled(c, '#f5f5f5', () => {
    c.moveTo(24, 71);
    c.bezierCurveTo(7, 51, 22, 23, 48, 23);
    c.quadraticCurveTo(57, 23, 65, 28);
    c.lineTo(59, 35);
    c.bezierCurveTo(37, 24, 19, 48, 31, 63);
    c.lineTo(84, 21);
    c.lineTo(30, 83);
    c.quadraticCurveTo(23, 87, 17, 85);
    c.closePath();
  });
  filled(c, '#f5f5f5', () => {
    c.moveTo(44, 78);
    c.lineTo(51, 70);
    c.bezierCurveTo(68, 71, 75, 57, 70, 45);
    c.lineTo(77, 37);
    c.bezierCurveTo(91, 59, 71, 85, 44, 78);
  });
};

const jira: IconPainter = (c) => {
  fillPolygon(c, [[49, 5], [94, 50], [68, 50], [49, 31], [30, 50], [5, 50]], '#2684ff');
  fillPolygon(c, [[5, 50], [30, 50], [49, 69], [68, 50], [94, 50], [49, 95]], '#2684ff');
  fillPolygon(c, [[49, 5], [49, 31], [30, 50], [5, 50]], gradient(c, '#0065dc', '#2684ff', 47, 10, 10, 51));
  fillPolygon(c, [[49, 95], [49, 69], [68, 50], [94, 50]], gradient(c, '#0065dc', '#2684ff', 51, 90, 92, 48));
};

const slack: IconPainter = (c) => {
  const colors = ['#36c5f0', '#2eb67d', '#ecb22e', '#e01e5a'];
  colors.forEach((color, quadrant) => {
    c.save();
    c.translate(50, 50);
    c.rotate(quadrant * Math.PI / 2);
    fillRound(c, -44, -21, 39, 16, 8, color);
    filled(c, color, () => {
      c.arc(-13, -36, 8, Math.PI / 2, Math.PI * 2);
      c.lineTo(-5, -28);
      c.closePath();
    });
    c.restore();
  });
};

const spotify: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#1ed760');
  const waves = [
    [23, 37, 56, 79, 43, 8],
    [26, 51, 54, 73, 56, 7],
    [30, 64, 51, 67, 69, 6],
  ];
  for (const [x, y, mid, end, endY, width] of waves) {
    stroked(c, '#191414', width, () => {
      c.moveTo(x, y);
      c.quadraticCurveTo(mid, y - 9, end, endY);
    });
  }
};

const netflix: IconPainter = (c) => {
  tile(c, '#141414');
  fillPolygon(c, [[29, 14], [44, 14], [44, 83], [29, 86]], '#b1060e');
  fillPolygon(c, [[56, 14], [71, 14], [71, 86], [56, 83]], '#b1060e');
  fillPolygon(c, [[29, 14], [44, 14], [71, 86], [56, 83]], gradient(c, '#f1121c', '#dd0812', 26, 20, 73, 80));
};

const googleCalendar: IconPainter = (c) => {
  fillPolygon(c, [[14, 6], [86, 6], [94, 14], [94, 74], [74, 94], [14, 94], [6, 86], [6, 14]], '#4285f4');
  fillPolygon(c, [[26, 26], [74, 26], [74, 74], [26, 74]], '#ffffff');
  fillPolygon(c, [[6, 26], [26, 26], [26, 74], [6, 74]], '#1967d2');
  fillPolygon(c, [[74, 26], [94, 26], [94, 74], [74, 74]], '#fbbc04');
  fillPolygon(c, [[6, 74], [26, 74], [26, 94], [14, 94], [6, 86]], '#188038');
  fillPolygon(c, [[26, 74], [74, 74], [74, 94], [26, 94]], '#34a853');
  fillPolygon(c, [[74, 74], [94, 74], [74, 94]], '#ea4335');
  letter(c, '31', '#4285f4', 33);
};

const googleWorkspace: IconPainter = (c) => {
  tile(c, '#ffffff', 19);
  const arcs = [[-153, -46, '#ea4335'], [132, 207, '#fbbc05'], [45, 132, '#34a853'], [-4, 45, '#4285f4']] as const;
  c.lineWidth = 12;
  for (const [from, to, color] of arcs) {
    c.strokeStyle = color;
    c.beginPath();
    c.arc(50, 50, 27, from * Math.PI / 180, to * Math.PI / 180);
    c.stroke();
  }
  fillRound(c, 50, 44, 33, 12, 0, '#4285f4');
};

const github: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#f0f6fc');
  filled(c, '#161b22', () => {
    c.moveTo(50, 8);
    c.bezierCurveTo(74, 8, 92, 27, 92, 51);
    c.bezierCurveTo(92, 70, 80, 86, 63, 91);
    c.quadraticCurveTo(59, 92, 59, 88);
    c.lineTo(59, 77);
    c.quadraticCurveTo(59, 70, 55, 68);
    c.bezierCurveTo(72, 66, 79, 56, 73, 44);
    c.quadraticCurveTo(75, 37, 72, 29);
    c.quadraticCurveTo(66, 28, 58, 34);
    c.quadraticCurveTo(50, 32, 42, 34);
    c.quadraticCurveTo(34, 28, 28, 29);
    c.quadraticCurveTo(25, 37, 27, 44);
    c.bezierCurveTo(21, 56, 28, 66, 45, 68);
    c.quadraticCurveTo(42, 70, 41, 75);
    c.bezierCurveTo(30, 79, 30, 67, 23, 68);
    c.bezierCurveTo(19, 68, 23, 71, 25, 73);
    c.bezierCurveTo(28, 80, 33, 83, 41, 81);
    c.lineTo(41, 88);
    c.quadraticCurveTo(41, 92, 37, 91);
    c.bezierCurveTo(20, 86, 8, 70, 8, 51);
    c.bezierCurveTo(8, 27, 26, 8, 50, 8);
  });
};

const bitbucket: IconPainter = (c) => {
  const blue = gradient(c, '#2684ff', '#0052cc', 26, 16, 82, 84);
  fillPolygon(c, [[7, 14], [93, 14], [89, 38], [64, 38], [63, 39], [36, 39], [41, 64], [58, 64], [54, 85], [21, 85]], blue);
  fillPolygon(c, [[64, 38], [89, 38], [81, 85], [54, 85]], '#2684ff');
};

const githubActions: IconPainter = (c) => {
  const blue = '#218bff';
  filled(c, blue, () => {
    c.moveTo(48, 18);
    c.arc(30, 18, 17, 0, Math.PI * 2);
  });
  fillPolygon(c, [[25, 10], [38, 18], [25, 26]], '#ffffff');
  stroked(c, blue, 5, () => {
    c.moveTo(30, 36);
    c.lineTo(30, 77);
    c.quadraticCurveTo(30, 83, 36, 83);
    c.lineTo(57, 83);
    c.moveTo(30, 51);
    c.lineTo(57, 51);
  });
  for (const y of [51, 83]) {
    c.strokeStyle = blue;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(70, y, 12, 0, Math.PI * 2);
    c.stroke();
    stroked(c, blue, 3.5, () => {
      c.moveTo(65, y);
      c.lineTo(69, y + 4);
      c.lineTo(75, y - 4);
    });
  }
};

const bitbucketPipelines: IconPainter = (c) => {
  tile(c, '#0052cc');
  fillRound(c, 20, 25, 29, 20, 4, '#79b8ff');
  fillRound(c, 52, 25, 29, 20, 4, '#ffffff');
  fillRound(c, 36, 55, 29, 20, 4, '#ffffff');
  line(c, 35, 45, 35, 52, '#79b8ff', 4);
  line(c, 66, 45, 66, 52, '#ffffff', 4);
  line(c, 35, 52, 66, 52, '#ffffff', 4);
  line(c, 50, 52, 50, 56, '#ffffff', 4);
};

const nodejs: IconPainter = (c) => {
  const green = '#5fa04e';
  stroked(c, green, 6, () => {
    c.moveTo(21, 68);
    c.lineTo(13, 64);
    c.lineTo(13, 31);
    c.lineTo(50, 9);
    c.lineTo(87, 31);
    c.lineTo(87, 70);
    c.lineTo(50, 91);
    c.lineTo(32, 81);
  });
  stroked(c, green, 6, () => {
    c.moveTo(39, 37);
    c.lineTo(39, 62);
    c.quadraticCurveTo(38, 74, 25, 70);
    c.moveTo(71, 41);
    c.bezierCurveTo(67, 33, 50, 35, 50, 43);
    c.bezierCurveTo(50, 51, 72, 46, 72, 58);
    c.bezierCurveTo(72, 69, 52, 71, 48, 61);
  });
};

const x: IconPainter = (c) => {
  tile(c, '#000000');
  fillPolygon(c, [[22, 76], [71, 24], [78, 24], [29, 76]], '#ffffff');
  c.beginPath();
  c.moveTo(21, 24);
  c.lineTo(37, 24);
  c.lineTo(79, 76);
  c.lineTo(63, 76);
  c.closePath();
  c.moveTo(29, 28);
  c.lineTo(35, 28);
  c.lineTo(71, 72);
  c.lineTo(65, 72);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill('evenodd');
};

const windows: IconPainter = (c) => {
  for (const [x, y] of [[8, 8], [52, 8], [8, 52], [52, 52]] as const) {
    fillRound(c, x, y, 40, 40, 0, '#00a4ef');
  }
};

const windowsTerminal: IconPainter = (c) => {
  fillRound(c, 4, 15, 92, 70, 9, '#5c5c5c');
  fillRound(c, 8, 19, 84, 62, 6, gradient(c, '#313134', '#101012'));
  fillRound(c, 13, 23, 41, 13, 3, '#171719');
  line(c, 60, 29, 68, 29, '#a0a0a6', 2);
  line(c, 64, 25, 64, 33, '#a0a0a6', 2);
  stroked(c, '#ffffff', 5, () => {
    c.moveTo(24, 47);
    c.lineTo(35, 56);
    c.lineTo(24, 65);
  });
  line(c, 41, 65, 55, 65, '#ffffff', 5);
};

const powershell: IconPainter = (c) => {
  const blue = gradient(c, '#5391fe', '#2c52a3', 42, 16, 62, 82);
  fillPolygon(c, [[22, 16], [94, 16], [80, 84], [6, 84]], '#162b5a');
  fillPolygon(c, [[23, 16], [94, 16], [79, 79], [7, 79]], blue);
  stroked(c, '#ffffff', 8, () => {
    c.moveTo(35, 31);
    c.lineTo(54, 46);
    c.lineTo(28, 65);
  });
  fillRound(c, 51, 61, 23, 7, 3, '#ffffff');
};

const wsl: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#2d2f3a');
  filled(c, '#151515', () => {
    c.moveTo(33, 41);
    c.bezierCurveTo(32, 22, 40, 15, 50, 15);
    c.bezierCurveTo(60, 15, 68, 22, 67, 41);
    c.bezierCurveTo(67, 50, 85, 59, 80, 77);
    c.quadraticCurveTo(70, 85, 63, 80);
    c.lineTo(37, 80);
    c.quadraticCurveTo(30, 85, 20, 77);
    c.bezierCurveTo(15, 59, 33, 50, 33, 41);
  });
  filled(c, '#f4f4f4', () => c.ellipse(50, 62, 17, 21, 0, 0, Math.PI * 2));
  for (const x of [44, 56]) {
    filled(c, '#fff', () => c.ellipse(x, 35, 4.5, 7, 0, 0, Math.PI * 2));
    fillDisc(c, x + (50 - x) / 4, 36, 2, '#141414');
  }
  filled(c, '#ffbf3e', () => c.ellipse(50, 45, 10, 5, 0, 0, Math.PI * 2));
  for (const [x, rotation] of [[32, -0.25], [68, 0.25]]) {
    filled(c, '#ffbf3e', () => c.ellipse(x, 80, 13, 6, rotation, 0, Math.PI * 2));
  }
};

const explorer: IconPainter = (c) => {
  fillRound(c, 7, 18, 40, 22, 7, '#ffa900');
  fillRound(c, 7, 26, 86, 58, 7, gradient(c, '#ffe176', '#f2ad23', 10, 26, 10, 84));
  fillRound(c, 24, 47, 54, 37, 6, gradient(c, '#36bcf5', '#0a65c8'));
  fillRound(c, 29, 53, 44, 8, 3, '#a2e6ff');
  fillRound(c, 7, 70, 86, 14, 6, '#ffc441');
};

const ubuntu: IconPainter = (c) => {
  fillDisc(c, 50, 50, 46, '#e95420');
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    stroked(c, '#ffffff', 6, () => c.arc(50, 50, 23, angle + 0.34, angle + Math.PI * 2 / 3 - 0.34));
    fillDisc(c, 50 + Math.cos(angle) * 30, 50 + Math.sin(angle) * 30, 7.5, '#ffffff');
  }
};

const docker: IconPainter = (c) => {
  const blue = '#2496ed';
  filled(c, blue, () => {
    c.moveTo(4, 53);
    c.lineTo(72, 53);
    c.quadraticCurveTo(71, 41, 79, 34);
    c.quadraticCurveTo(86, 39, 85, 47);
    c.quadraticCurveTo(91, 44, 98, 48);
    c.quadraticCurveTo(95, 60, 81, 61);
    c.bezierCurveTo(73, 81, 58, 87, 38, 87);
    c.bezierCurveTo(18, 87, 4, 76, 4, 53);
  });
  for (const [column, row] of [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1], [3, 2]]) {
    fillRound(c, 9 + column * 12.5, 41 - row * 12.5, 10.5, 10, 1, blue);
  }
  fillDisc(c, 26, 64, 2.5, '#ffffff');
};

const deepseek: IconPainter = (c) => {
  const blue = '#4d6bfe';
  filled(c, blue, () => {
    c.moveTo(8, 29);
    c.bezierCurveTo(8, 59, 25, 78, 51, 78);
    c.quadraticCurveTo(67, 78, 76, 87);
    c.quadraticCurveTo(76, 77, 70, 71);
    c.quadraticCurveTo(83, 64, 84, 50);
    c.quadraticCurveTo(96, 44, 95, 29);
    c.quadraticCurveTo(88, 36, 81, 32);
    c.quadraticCurveTo(79, 20, 67, 16);
    c.quadraticCurveTo(70, 24, 65, 35);
    c.bezierCurveTo(42, 24, 23, 37, 8, 29);
  });
  fillDisc(c, 29, 48, 4, '#ffffff');
  stroked(c, '#ffffff', 3.5, () => {
    c.moveTo(16, 57);
    c.quadraticCurveTo(24, 67, 36, 64);
  });
};

const qwen: IconPainter = (c) => {
  for (let i = 0; i < 3; i++) {
    c.save();
    c.translate(50, 50);
    c.rotate(i * Math.PI / 3);
    stroked(c, ['#5148cf', '#6959ef', '#896bff'][i], 9, () => {
      c.moveTo(-22, -36);
      c.lineTo(22, -36);
      c.lineTo(31, -20);
      c.lineTo(-22, 36);
      c.lineTo(-31, 20);
      c.closePath();
    });
    c.restore();
  }
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

const iterm2: IconPainter = (c) => {
  fillRound(c, 5, 14, 90, 73, 12, gradient(c, '#64656a', '#252629'));
  fillRound(c, 9, 18, 82, 65, 8, '#141616');
  for (const [x, color] of [[17, '#fc605c'], [25, '#fdbc40'], [33, '#32ca52']] as const) {
    fillDisc(c, x, 26, 2.4, color);
  }
  stroked(c, '#65e58d', 5, () => {
    c.moveTo(25, 42);
    c.lineTo(36, 51);
    c.lineTo(25, 60);
  });
  fillRound(c, 44, 55, 13, 7, 1, '#65e58d');
};

const postman: IconPainter = (c) => {
  const orange = APP_ACCENT.Postman;
  fillDisc(c, 50, 50, 46, orange);
  filled(c, '#ffffff', () => {
    c.moveTo(25, 62);
    c.lineTo(38, 48);
    c.bezierCurveTo(47, 36, 57, 29, 68, 28);
    c.lineTo(72, 34);
    c.bezierCurveTo(65, 46, 54, 55, 42, 61);
    c.lineTo(32, 72);
    c.lineTo(18, 76);
    c.lineTo(27, 67);
    c.closePath();
  });
  fillPolygon(c, [[39, 48], [29, 46], [21, 54], [32, 55]], '#ffffff');
  fillDisc(c, 70, 28, 10, '#ffffff');
  fillDisc(c, 70, 28, 6, orange);
  stroked(c, orange, 2.6, () => {
    c.moveTo(36, 50);
    c.lineTo(43, 57);
    c.moveTo(29, 67);
    c.lineTo(36, 61);
    c.moveTo(51, 46);
    c.lineTo(63, 36);
  });
};

export const ICONS: Readonly<Record<AppName, IconPainter>> = {
  Cursor: cursor,
  'VS Code': vscode,
  Xcode: xcode,
  'Claude Code': claudeCode,
  Codex: codex,
  Gemini: gemini,
  Grok: grok,
  iTerm2: iterm2,
  WezTerm: terminalIcon('#2a2040', '#9b6bff', '#d9c4ff'),
  'Windows Terminal': windowsTerminal,
  Chrome: chrome,
  Postman: postman,
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
