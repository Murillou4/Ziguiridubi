import { BlueprintConfig } from '../config/buildings.ts';

const TAU = Math.PI * 2;

const WOOD = { top: '#c69356', front: '#936139', side: '#63412b', trim: '#dfa968' };
const TIMBER_DARK = { top: '#9d6c3e', front: '#724926', side: '#4b2f18', trim: '#b7814e' };
const BRICK = { top: '#bbb09a', front: '#8f8171', side: '#6a6055', trim: '#cfc4ae' };
const METAL = { top: '#94adb0', front: '#607b7f', side: '#3f575c', trim: '#b7ced0' };
const BRASS = { top: '#e5be73', front: '#b6893e', side: '#7d5a24', trim: '#f5d796' };

type Material = {
  top: string;
  front: string;
  side: string;
  trim?: string;
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutCubic(t: number): number {
  const inv = 1 - clamp01(t);
  return 1 - inv * inv * inv;
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function block(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  material: Material
): void {
  ctx.fillStyle = material.front;
  ctx.fillRect(x, y, width, height);

  if (material.trim && height > 3) {
    ctx.fillStyle = material.trim;
    ctx.fillRect(x + 1, y, Math.max(0, width - 2), 1.4);
  }

  ctx.fillStyle = material.side;
  ctx.beginPath();
  ctx.moveTo(x + width, y);
  ctx.lineTo(x + width + depth, y - depth * 0.65);
  ctx.lineTo(x + width + depth, y + height - depth * 0.65);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = material.top;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + depth, y - depth * 0.65);
  ctx.lineTo(x + width + depth, y - depth * 0.65);
  ctx.lineTo(x + width, y);
  ctx.closePath();
  ctx.fill();
}

function log(ctx: CanvasRenderingContext2D, x: number, y: number, angle = -0.25): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#755030';
  ctx.fillRect(0, -6, 26, 12);
  ellipse(ctx, 26, 0, 4, 6, '#755030');
  ctx.fillStyle = '#a87947';
  ctx.fillRect(0, -5, 24, 2);
  ctx.fillRect(5, 1, 20, 1);
  ellipse(ctx, 0, 0, 4.5, 6, '#d2a265');
  ellipse(ctx, 0, 0, 2, 3, '#ad7845');
  ctx.restore();
}

function plankStack(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  block(ctx, x, y, 22, 3.2, 7, WOOD);
  block(ctx, x + 1, y - 3.5, 20, 3.2, 6.5, WOOD);
}

/**
 * Desenha uma peça independente quando `progress` alcança `start`.
 * A peça surge suavemente de `start` até `end` e permanece visível após `end`.
 */
function placePart(
  ctx: CanvasRenderingContext2D,
  progress: number,
  start: number,
  end: number,
  draw: () => void
): void {
  if (progress <= start) return;
  const span = Math.max(0.0001, end - start);
  const amount = easeOutCubic((progress - start) / span);
  ctx.save();
  ctx.globalAlpha *= amount;
  ctx.translate(0, -7 * (1 - amount));
  draw();
  ctx.restore();
}

function drawSawBlade(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, spin: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.78);
  ctx.rotate(spin);

  ctx.fillStyle = METAL.front;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const baseAngle = (i * TAU) / 10;
    const tipAngle = baseAngle + TAU / 20;
    const innerR = radius * 0.78;
    const outerR = radius * 1.15;
    const x1 = Math.cos(baseAngle) * innerR;
    const y1 = Math.sin(baseAngle) * innerR;
    const x2 = Math.cos(tipAngle) * outerR;
    const y2 = Math.sin(tipAngle) * outerR;
    const x3 = Math.cos(baseAngle + TAU / 10) * innerR;
    const y3 = Math.sin(baseAngle + TAU / 10) * innerR;
    if (i === 0) ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
  }
  ctx.closePath();
  ctx.fill();

  ellipse(ctx, 0, 0, radius * 0.78, radius * 0.78, METAL.top);
  ellipse(ctx, 0, 0, radius * 0.28, radius * 0.28, BRASS.front);
  ctx.restore();
}

function drawSawmill(ctx: CanvasRenderingContext2D, progress: number, time: number, built: boolean): void {
  // Peça 1: Base e cavalete inferior da serraria
  placePart(ctx, progress, 0.0, 0.22, () => {
    block(ctx, -20, 13, 50, 5, 13, WOOD);
    block(ctx, -15, 18, 5, 4, 3, TIMBER_DARK);
    block(ctx, 21, 18, 5, 4, 3, TIMBER_DARK);
  });

  // Peça 2: Suportes verticais e escoras diagonais
  placePart(ctx, progress, 0.22, 0.46, () => {
    block(ctx, 4, -10, 5, 23, 4, TIMBER_DARK);
    block(ctx, 24, -14, 5, 23, 4, TIMBER_DARK);
    ctx.strokeStyle = TIMBER_DARK.side;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(6.5, 12);
    ctx.lineTo(14, 2);
    ctx.moveTo(26.5, 8);
    ctx.lineTo(19, -2);
    ctx.stroke();
  });

  // Peça 3: Guia superior e disco de serra metálico
  placePart(ctx, progress, 0.46, 0.72, () => {
    block(ctx, 0, -14, 34, 5.5, 9, WOOD);
    const spin = built ? time * 4.5 : 0;
    drawSawBlade(ctx, 18, -16, 7.5, spin);
  });

  // Peça 4: Pilha de toras e tábuas serradas
  placePart(ctx, progress, 0.72, 1.0, () => {
    log(ctx, -23, 4);
    log(ctx, -27, 10);
    log(ctx, -18, 16);
    plankStack(ctx, 6, 8);
  });
}

function drawFurnace(ctx: CanvasRenderingContext2D, progress: number, time: number, built: boolean): void {
  // Peça 1: Base de pedra/tijolo
  placePart(ctx, progress, 0.0, 0.2, () => {
    block(ctx, -23, 9, 38, 6, 13, BRICK);
  });

  // Peça 2: Pilares e câmara inferior com abertura de fornalha
  placePart(ctx, progress, 0.2, 0.42, () => {
    block(ctx, -18, 1, 11, 8, 12, BRICK);
    block(ctx, 4, 1, 11, 8, 12, BRICK);
    ellipse(ctx, -1.5, 6.5, 5.2, 3.2, '#2d241e');
    const emberPulse = built ? 0.75 + 0.25 * Math.sin(time * 6) : 0.35;
    ctx.save();
    ctx.globalAlpha *= emberPulse;
    ellipse(ctx, -1.5, 7.2, 3.6, 1.8, '#f97316');
    ctx.restore();
  });

  // Peça 3: Corpo superior e cinta de ferro
  placePart(ctx, progress, 0.42, 0.66, () => {
    block(ctx, -18, -7, 11, 8, 12, BRICK);
    block(ctx, 4, -7, 11, 8, 12, BRICK);
    block(ctx, -18, -14, 33, 7, 12, BRICK);
    ctx.fillStyle = METAL.front;
    ctx.fillRect(-18, -8.5, 33, 2);
    ellipse(ctx, 0, 6, 4, 1.8, '#504b44');
  });

  // Peça 4: Fuste da chaminé
  placePart(ctx, progress, 0.66, 0.86, () => {
    block(ctx, -1, -37, 12, 19, 8, BRICK);
    ctx.fillStyle = METAL.front;
    ctx.fillRect(-1, -28, 12, 1.8);
  });

  // Peça 5: Coroa e duto da chaminé
  placePart(ctx, progress, 0.86, 1.0, () => {
    block(ctx, -4, -40, 18, 5, 9, BRICK);
    ellipse(ctx, 9, -43, 5, 1.8, '#3d3732');
  });
}

function drawGear(ctx: CanvasRenderingContext2D, angle: number): void {
  ctx.save();
  ctx.translate(9, -9);
  ctx.scale(1, 0.69);
  ctx.fillStyle = '#6d4e34';
  ctx.beginPath();
  ctx.arc(0, 2.5, 11, 0, TAU);
  ctx.fill();

  ctx.rotate(angle);
  ctx.strokeStyle = BRASS.front;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = BRASS.top;
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(-2, -13, 4, 4);
    ctx.rotate(TAU / 8);
  }
  ellipse(ctx, 0, 0, 2.5, 2.5, METAL.top);
  ctx.restore();
}

function drawGearWorkshop(
  ctx: CanvasRenderingContext2D,
  progress: number,
  time: number,
  built: boolean
): void {
  // Peça 1: Plataforma/base da oficina
  placePart(ctx, progress, 0.0, 0.25, () => {
    block(ctx, -28, 12, 43, 5, 14, WOOD);
  });

  // Peça 2: Corpo da bancada/oficina com prateleiras e suportes
  placePart(ctx, progress, 0.25, 0.54, () => {
    block(ctx, -23, -3, 33, 15, 12, WOOD);
    block(ctx, -25, -4, 4, 16, 3, TIMBER_DARK);
    block(ctx, 8, -4, 4, 16, 3, TIMBER_DARK);
    ctx.fillStyle = TIMBER_DARK.side;
    ctx.fillRect(-19, 4, 25, 1.5);
    ctx.fillRect(-19, 9, 25, 1.5);
  });

  // Peça 3: Engrenagem principal montada
  placePart(ctx, progress, 0.54, 0.8, () => {
    drawGear(ctx, built ? time * 1.1 : 0);
  });

  // Peça 4: Bigorna / bloco metálico de acabamento
  placePart(ctx, progress, 0.8, 1.0, () => {
    block(ctx, 20, 9.5, 12, 5.5, 4.5, METAL);
    block(ctx, 18, 8.5, 5, 2.5, 4.5, METAL);
  });
}

function drawDroneFrame(ctx: CanvasRenderingContext2D, time: number, built: boolean): void {
  ctx.save();
  ctx.translate(-33, 7);
  ctx.strokeStyle = METAL.side;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(7, -15);
  ctx.lineTo(33, -5);
  ctx.moveTo(9, -5);
  ctx.lineTo(29, -16);
  ctx.stroke();

  const rotors: ReadonlyArray<[number, number]> = [
    [7, -15],
    [33, -5],
    [9, -5],
    [29, -16]
  ];
  for (let i = 0; i < rotors.length; i++) {
    const [rx, ry] = rotors[i];
    ellipse(ctx, rx, ry, 5, 2.8, METAL.top);
    if (built) {
      const span = 2.2 + 2.4 * Math.abs(Math.sin(time * 24 + i * 1.4));
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rx - span, ry - 1.5);
      ctx.lineTo(rx + span, ry + 1.5);
      ctx.stroke();
    }
  }
  ellipse(ctx, 20, -10, 6, 3.4, BRASS.front);
  ctx.restore();
}

function drawDroneStation(
  ctx: CanvasRenderingContext2D,
  progress: number,
  time: number,
  built: boolean
): void {
  // Peça 1: Plataforma de pouso
  placePart(ctx, progress, 0.0, 0.25, () => {
    block(ctx, -30, 12, 58, 5, 11, WOOD);
    ellipse(ctx, -1, 13.5, 14, 4.2, 'rgba(245, 215, 150, 0.28)');
  });

  // Peça 2: Suportes laterais e torre de controle
  placePart(ctx, progress, 0.25, 0.56, () => {
    block(ctx, -27, 2, 23, 10, 8, WOOD);
    block(ctx, 9, -1, 21, 13, 12, WOOD);
    block(ctx, 18, -14, 4, 13, 4, METAL);
  });

  // Peça 3: Módulo/bateria metálica da estação
  placePart(ctx, progress, 0.56, 0.78, () => {
    block(ctx, -24, -5, 18, 7, 7, METAL);
    ellipse(ctx, -15, -6.5, 3.5, 1.8, built ? '#7dd3fc' : METAL.trim);
  });

  // Peça 4: Estrutura e rotores do drone
  placePart(ctx, progress, 0.78, 1.0, () => {
    drawDroneFrame(ctx, time, built);
  });
}

function drawDock(ctx: CanvasRenderingContext2D, progress: number): void {
  // Peças 1..3: Seções do píer de madeira em sequência
  for (let i = 0; i < 3; i++) {
    const start = i * 0.2;
    const end = (i + 1) * 0.2;
    placePart(ctx, progress, start, end, () => {
      block(ctx, -34 + i * 2, 14 - i * 5, 61, 5, 9, WOOD);
    });
  }

  // Peça 4: Pilares/suportes de amarração
  placePart(ctx, progress, 0.6, 0.85, () => {
    block(ctx, -25, -7, 7, 23, 4, TIMBER_DARK);
    block(ctx, 24, -12, 7, 23, 4, TIMBER_DARK);
  });

  // Peça 5: Cabeços metálicos de atracagem e cabo de guia
  placePart(ctx, progress, 0.85, 1.0, () => {
    block(ctx, -29, -10, 12, 4, 6, METAL);
    block(ctx, 20, -15, 12, 4, 6, METAL);
    ctx.strokeStyle = BRASS.front;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-23, -8);
    ctx.quadraticCurveTo(0, -2, 26, -13);
    ctx.stroke();
  });
}

const FOUNDATION_EDGE = [
  [-44, 4], [-33, -12], [-9, -17], [30, -16], [46, -3],
  [42, 16], [29, 27], [-27, 27], [-42, 18]
] as const;

function fillFoundation(ctx: CanvasRenderingContext2D, offset: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(FOUNDATION_EDGE[0][0], FOUNDATION_EDGE[0][1] + offset);
  for (let i = 1; i < FOUNDATION_EDGE.length; i++) {
    const [x, y] = FOUNDATION_EDGE[i];
    ctx.lineTo(x, y + offset);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSiteFoundation(ctx: CanvasRenderingContext2D): void {
  fillFoundation(ctx, 3, '#60543d');
  fillFoundation(ctx, 0, '#98815b');
  ellipse(ctx, -36, 15, 4, 2.1, '#bba37a');
  ellipse(ctx, -29, 21, 3, 1.6, '#c7ad7f');
  ellipse(ctx, 30, 22, 4.5, 2, '#bba37a');
  ellipse(ctx, 39, 9, 3.5, 2.3, '#c7ad7f');
  ellipse(ctx, 4, 22, 3, 1.3, '#7e6a4c');
  ellipse(ctx, 6, 13, 33, 9, 'rgba(42, 33, 22, .24)');
}

function drawSiteSign(ctx: CanvasRenderingContext2D, name: string): void {
  ctx.font = 'bold 9px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const split = name.lastIndexOf(' ');
  const lines = ctx.measureText(name).width > 64 && split > 0
    ? [name.slice(0, split), name.slice(split + 1)]
    : [name];
  const width = Math.max(44, Math.ceil(Math.max(...lines.map(line => ctx.measureText(line).width))) + 16);
  const left = -width / 2;
  const right = width / 2;
  const bottom = -2;
  const top = bottom - 9 - 10 * lines.length;
  const post = width / 5;

  ellipse(ctx, -post + 2, 16, 6, 2.5, 'rgba(48, 32, 19, .36)');
  ellipse(ctx, post + 2, 16, 6, 2.5, 'rgba(48, 32, 19, .36)');
  block(ctx, -post, -6, 4, 22, 2, TIMBER_DARK);
  block(ctx, post, -6, 4, 22, 2, TIMBER_DARK);

  ctx.fillStyle = WOOD.front;
  ctx.strokeStyle = TIMBER_DARK.side;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(left + 3, top);
  ctx.lineTo(right - 3, top);
  ctx.lineTo(right, top + 3);
  ctx.lineTo(right, bottom - 3);
  ctx.lineTo(right - 3, bottom);
  ctx.lineTo(left + 3, bottom);
  ctx.lineTo(left, bottom - 3);
  ctx.lineTo(left, top + 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = WOOD.trim;
  ctx.fillRect(left + 4, top + 1.5, width - 8, 1.5);
  ctx.fillStyle = TIMBER_DARK.front;
  ctx.fillRect(left + 4, bottom - 3, width - 8, 1);
  ctx.fillRect(left + 2, top + 5, 5, 1);
  ctx.fillRect(right - 8, bottom - 5, 6, 1);
  const pinY = (top + bottom) / 2;
  ellipse(ctx, left + 4, pinY, 1.5, 1.5, BRASS.top);
  ellipse(ctx, right - 4, pinY, 1.5, 1.5, BRASS.top);

  ctx.fillStyle = TIMBER_DARK.side;
  lines.forEach((line, index) => ctx.fillText(line, 0, top + 10 + 10 * index));
  ctx.fillStyle = '#fff0cb';
  lines.forEach((line, index) => ctx.fillText(line, 0, top + 9 + 10 * index));
}

export interface ConstructionDrawOptions {
  time?: number;
  built?: boolean;
}

export function drawConstructionSite(
  ctx: CanvasRenderingContext2D,
  bp: BlueprintConfig,
  progress: number,
  options: ConstructionDrawOptions = {}
): void {
  const time = options.time ?? 0;
  const built = options.built ?? progress >= 1;

  ctx.save();
  ctx.translate(bp.x + bp.w / 2, bp.y + bp.h / 2);

  drawSiteFoundation(ctx);

  switch (bp.id) {
    case 'sawmill':
      drawSawmill(ctx, progress, time, built);
      break;
    case 'furnace':
      drawFurnace(ctx, progress, time, built);
      break;
    case 'gearWorkshop':
      drawGearWorkshop(ctx, progress, time, built);
      break;
    case 'droneStation':
      drawDroneStation(ctx, progress, time, built);
      break;
    case 'airshipDock':
      drawDock(ctx, progress);
      break;
  }

  if (!built) drawSiteSign(ctx, bp.name);

  ctx.restore();
}
