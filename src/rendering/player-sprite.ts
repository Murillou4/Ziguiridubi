/**
 * player-sprite.ts
 * ----------------------------------------------------------------------------
 * Personagem principal (explorador-coletor com ferramenta) desenhado 100% por código
 * com a API Canvas 2D. Sem dependências, sem imagens, sem sprite sheet.
 *
 * - Visão 3/4 (oblíqua): "down" (frente), "up" (costas), "right" (lado).
 *   "left" é o "right" espelhado com ctx.scale(-1, 1).
 * - Luz vinda do canto superior esquerdo; 3 tons por forma (sombra, base, brilho)
 *   e contorno fino em um tom escuro da própria cor (nunca preto puro).
 * - (x, y) é o ponto dos pés (centro do contato com o chão): ordene por y.
 * - Tamanho em escala 1: ~30px de largura x ~43px de altura (sem a ferramenta).
 *
 * Animações (tudo procedural, a partir de pose.time em segundos):
 * - Parado: respiração (~2s) e pequenos balanços.
 * - Andando: passos, quique, braços e mochila balançando.
 * - Golpe (pose.swing 0..1): preparação -> corte rápido (com rastro) -> recuperação.
 */

import type { ResourceId } from '../domain/types.ts';
import { drawResourceIcon } from './world-drops.ts';

export type Facing = "down" | "up" | "left" | "right";

export interface PlayerPose {
  facing: Facing;
  /** Relógio contínuo do jogo, em segundos. */
  time: number;
  moving?: boolean;
  /** Progresso do golpe da ferramenta: 0 = sem golpe; (0, 1] = golpe em andamento. */
  swing?: number;
  tool?: 'axe' | 'pickaxe';
  bladeColor?: string;
  packFill?: number;
  packOpen?: number;
  cargo?: readonly ResourceId[];
}

export interface DrawOptions {
  scale?: number;
  shadow?: boolean;
}

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ============================================================================
// Paleta: cada tom tem base, brilho (luz), sombra e contorno (mesmo matiz, escuro)
// ============================================================================
interface Tone {
  readonly base: string;
  readonly light: string;
  readonly dark: string;
  readonly line: string;
}

const SKIN: Tone = { base: "#f4c6a0", light: "#ffe4c9", dark: "#d99c76", line: "#a46747" };
const SKIN_F: Tone = { base: "#e6b28a", light: "#f4c9a4", dark: "#c58760", line: "#935a3b" };
const HAIR: Tone = { base: "#7b4a2a", light: "#a06b43", dark: "#55301a", line: "#3a1f10" };
const STRAW: Tone = { base: "#c98d48", light: "#e8b574", dark: "#9c6730", line: "#69401a" };
const BAND: Tone = { base: "#dc4a3c", light: "#f77f68", dark: "#aa302a", line: "#7a1f1d" };
const SHIRT: Tone = { base: "#f7efd9", light: "#ffffff", dark: "#d8caa8", line: "#9c8d6b" };
const SHIRT_F: Tone = { base: "#dcd2b1", light: "#eee5c8", dark: "#b8aa86", line: "#80734f" };
const VEST: Tone = { base: "#a8622f", light: "#cc8647", dark: "#72401c", line: "#472510" };
const PANTS: Tone = { base: "#46689e", light: "#6a8bc2", dark: "#2f4975", line: "#1d3050" };
const PANTS_F: Tone = { base: "#38577f", light: "#4f6f9f", dark: "#263f66", line: "#18243d" };
const BOOT: Tone = { base: "#6c4023", light: "#926036", dark: "#43250f", line: "#2a150a" };
const BOOT_F: Tone = { base: "#54311a", light: "#704629", dark: "#341c0c", line: "#1f0f06" };
const GLOVE: Tone = { base: "#8e5c31", light: "#b4824f", dark: "#5e3b1b", line: "#3b2210" };
const GLOVE_F: Tone = { base: "#74491f", light: "#966a3c", dark: "#4a2d12", line: "#2f1a0a" };
const BELT: Tone = { base: "#52321a", light: "#74492a", dark: "#35200f", line: "#22130a" };
const GOLD: Tone = { base: "#f5d058", light: "#fff3ae", dark: "#c99b23", line: "#80600f" };
const POUCH: Tone = { base: "#c27a3c", light: "#e39a5c", dark: "#8d5324", line: "#55300f" };
const PACK: Tone = { base: "#f08c2e", light: "#ffb75a", dark: "#bf6119", line: "#85410d" };
const PACK2: Tone = { base: "#d9721f", light: "#f79a48", dark: "#a8500f", line: "#6f3408" };
const ROLL: Tone = { base: "#ebdfba", light: "#fff8dc", dark: "#c4b488", line: "#8a7a50" };
const TEAL: Tone = { base: "#3f9f99", light: "#6fcbc4", dark: "#2a736f", line: "#16413e" };
const TIN: Tone = { base: "#c5cfd9", light: "#f6fafd", dark: "#8896a6", line: "#566577" };
const STEEL: Tone = { base: "#d3dce5", light: "#ffffff", dark: "#8d9eb2", line: "#566a7e" };
const WOOD: Tone = { base: "#b57d44", light: "#d9a064", dark: "#7c4f27", line: "#4e2e14" };

// ============================================================================
// Estado de animação reaproveitado (nenhuma alocação por frame)
// ============================================================================
const A = {
  moving: false,
  p: 0, // fase do passo (rad)
  ox: 0, // deslocamento do tronco/cabeça (inclinação do golpe)
  oy: 0, // deslocamento vertical do tronco (quique/respiração/agachar)
  bob: 0,
  sw: 0, // swing 0..1
  th: 0, // ângulo do braço da foice (rad, já espelhado se preciso)
  ga: 0, // ângulo do cabo da foice (rad)
  bs: 1, // escala da lâmina (perspectiva: encurta quando aponta pra câmera)
  effort: false,
  blink: false,
  pack: 0,
  mug: 0,
  pouch: 0,
  rib1: 0,
  rib2: 0,
  hair: 0,
};

// Keyframes do golpe, em graus:
// [braço repouso, braço preparação, braço fim do corte, braço repouso (desenrolado),
//  cabo repouso, cabo preparação, cabo fim do corte, cabo repouso (desenrolado), lâmina repouso]
const KF_SIDE: readonly number[] = [55, 215, 380, 415, 282, 232, 385, 282, 0.42];
const KF_FRONT: readonly number[] = [98, 235, 35, 98, 262, 215, 30, -98, 0.55];

const ARM_L = 8.6;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Resolve os ângulos do braço/cabo para o progresso s do golpe. */
function solveSwing(kf: readonly number[], s: number, mir: boolean): void {
  const bsR = kf[8];
  let th: number;
  let ga: number;
  let bs: number;
  if (s <= 0) {
    th = kf[0];
    ga = kf[4];
    bs = bsR;
  } else if (s < 0.28) {
    const u = s / 0.28;
    const e = 1 - (1 - u) * (1 - u) * (1 - u); // preparação: arranca e assenta
    th = lerp(kf[0], kf[1], e);
    ga = lerp(kf[4], kf[5], e);
    bs = lerp(bsR, 1, e);
  } else if (s < 0.5) {
    const u = (s - 0.28) / 0.22;
    const e = u * u * (3 - 2 * u); // corte rápido
    th = lerp(kf[1], kf[2], e);
    ga = lerp(kf[5], kf[6], e);
    bs = 1;
  } else {
    const u = (s - 0.5) / 0.5;
    const e = u * u * (3 - 2 * u); // recuperação suave
    th = lerp(kf[2], kf[3], e);
    ga = lerp(kf[6], kf[7], e);
    bs = lerp(1, bsR, e);
  }
  th *= DEG;
  ga *= DEG;
  if (mir) {
    th = Math.PI - th;
    ga = Math.PI - ga;
  }
  A.th = th;
  A.ga = ga;
  A.bs = bs;
}

/** Calcula todos os parâmetros de animação a partir da pose. */
function animate(pose: PlayerPose): void {
  const t = pose.time;
  const moving = pose.moving === true;
  let sw = pose.swing === undefined ? 0 : pose.swing;
  sw = sw < 0 ? 0 : sw > 1 ? 1 : sw;
  A.moving = moving;
  A.sw = sw;
  A.p = t * TAU * 1.9; // ~1,9 ciclos (3,8 passos) por segundo

  if (moving) {
    A.bob = Math.abs(Math.cos(A.p)) * 1.4; // corpo sobe quando as pernas se cruzam
    A.pack = 0.07 * Math.sin(2 * A.p - 1.0) + 0.02;
    A.mug = 0.24 * Math.sin(2 * A.p - 1.7);
    A.pouch = 0.2 * Math.sin(2 * A.p - 0.5);
    A.rib1 = 0.5 * Math.sin(2 * A.p - 0.8) + 0.3;
    A.rib2 = 0.5 * Math.sin(2 * A.p - 1.7) + 0.3;
    A.hair = 0.5 * Math.sin(2 * A.p - 0.6);
  } else {
    A.bob = (0.5 + 0.5 * Math.sin(t * Math.PI)) * 0.9; // respiração de ~2s
    A.pack = 0.015 * Math.sin(t * Math.PI - 0.6);
    A.mug = 0.06 * Math.sin(t * 2.4);
    A.pouch = 0.035 * Math.sin(t * 2.1);
    A.rib1 = 0.16 * Math.sin(t * 2.6);
    A.rib2 = 0.16 * Math.sin(t * 2.6 - 0.9);
    A.hair = 0.2 * Math.sin(t * 2.0);
  }
  A.oy = -A.bob;
  A.ox = 0;
  A.blink = t % 3.9 < 0.13;
  A.effort = sw > 0.22 && sw < 0.66;

  // Inclinação do corpo durante o golpe (recua na preparação, avança no corte)
  if (sw > 0) {
    let lean: number;
    if (sw < 0.28) {
      const u = sw / 0.28;
      lean = -1.3 * u * (2 - u);
    } else if (sw < 0.5) {
      const u = (sw - 0.28) / 0.22;
      lean = -1.3 + 3.4 * u * u * (3 - 2 * u);
    } else {
      const u = (sw - 0.5) / 0.5;
      lean = 2.1 * (1 - u * u * (3 - 2 * u));
    }
    const f = pose.facing;
    if (f === "left" || f === "right") A.ox = lean;
    else A.oy += (f === "down" ? 0.35 : -0.35) * lean;
    A.oy += 0.45 * Math.max(0, lean); // agacha um pouco no corte
  }
}

// ============================================================================
// Primitivas de pintura com 3 tons (sombra / base / brilho) + contorno
// ============================================================================
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
}

/** Com o clip já ativo: base deslocada p/ cima-esquerda (deixa a sombra no canto
 *  inferior-direito) e um brilho discreto no canto superior esquerdo. */
function shadeInClip(c: Ctx, t: Tone, bx: number, by: number, bw: number, bh: number): void {
  c.fillStyle = t.base;
  c.beginPath();
  c.ellipse(bx + bw * 0.4, by + bh * 0.4, bw * 0.64, bh * 0.64, 0, 0, TAU);
  c.fill();
  c.fillStyle = t.light;
  c.beginPath();
  c.ellipse(bx + bw * 0.3, by + bh * 0.26, bw * 0.2, bh * 0.12, -0.5, 0, TAU);
  c.fill();
}

function paintEllipse(c: Ctx, t: Tone, cx: number, cy: number, rx: number, ry: number, lw = 0.9): void {
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  c.fillStyle = t.dark;
  c.fill();
  c.save();
  c.clip();
  shadeInClip(c, t, cx - rx, cy - ry, rx * 2, ry * 2);
  c.restore();
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  c.lineWidth = lw;
  c.strokeStyle = t.line;
  c.stroke();
}

function paintRRect(c: Ctx, t: Tone, x: number, y: number, w: number, h: number, r: number, lw = 0.9): void {
  rr(c, x, y, w, h, r);
  c.fillStyle = t.dark;
  c.fill();
  c.save();
  c.clip();
  shadeInClip(c, t, x, y, w, h);
  c.restore();
  rr(c, x, y, w, h, r);
  c.lineWidth = lw;
  c.strokeStyle = t.line;
  c.stroke();
}

type Build = (c: Ctx) => void;

function paintPath(c: Ctx, build: Build, t: Tone, bx: number, by: number, bw: number, bh: number, lw = 0.9): void {
  build(c);
  c.fillStyle = t.dark;
  c.fill();
  c.save();
  c.clip();
  shadeInClip(c, t, bx, by, bw, bh);
  c.restore();
  build(c);
  c.lineWidth = lw;
  c.strokeStyle = t.line;
  c.stroke();
}

/** Membro arredondado (cápsula) com iluminação alinhada ao mundo. */
function tube(c: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, t: Tone): void {
  const ex = x2 + 0.001;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(ex, y2);
  c.strokeStyle = t.line;
  c.lineWidth = w + 1.6;
  c.stroke();
  c.strokeStyle = t.dark;
  c.lineWidth = w;
  c.stroke();
  c.beginPath();
  c.moveTo(x1 - 0.35, y1 - 0.35);
  c.lineTo(ex - 0.35, y2 - 0.35);
  c.strokeStyle = t.base;
  c.lineWidth = Math.max(0.5, w - 1.0);
  c.stroke();
  c.beginPath();
  c.moveTo(x1 - 0.85, y1 - 0.8);
  c.lineTo(ex - 0.85, y2 - 0.8);
  c.strokeStyle = t.light;
  c.lineWidth = Math.max(0.4, w * 0.28);
  c.stroke();
}

// ============================================================================
// Caminhos estáticos (criados uma vez; nenhum objeto novo por frame)
// ============================================================================
let K = 1; // lado do colete (+1 direito da tela, -1 esquerdo)

function vestPath(c: Ctx): void {
  c.beginPath();
  c.moveTo(K * 7.2, -17.6);
  c.quadraticCurveTo(K * 7.2, -21.4, K * 3.8, -21.4);
  c.lineTo(K * 2.4, -21.4);
  c.lineTo(K * 1.8, -16.6);
  c.lineTo(K * 1.5, -9.8);
  c.lineTo(K * 7.2, -9.8);
  c.closePath();
}

function crownPath(c: Ctx): void {
  c.beginPath();
  c.moveTo(-7.7, -33.4);
  c.bezierCurveTo(-8.3, -39.8, -4.6, -43.0, 0, -43.0);
  c.bezierCurveTo(4.6, -43.0, 8.3, -39.8, 7.7, -33.4);
  c.quadraticCurveTo(0, -30.6, -7.7, -33.4);
  c.closePath();
}

function bandPath(c: Ctx): void {
  c.beginPath();
  c.moveTo(-7.5, -36.4);
  c.quadraticCurveTo(0, -33.8, 7.5, -36.4);
  c.lineTo(7.65, -33.5);
  c.quadraticCurveTo(0, -30.9, -7.65, -33.5);
  c.closePath();
}

/** Lâmina curva da foice no referencial do cabo (cabo ao longo de -y). */

// ============================================================================
// Ferramenta, braços e luvas
// ============================================================================
let activeTool: PlayerPose['tool'];
let bladeColor: string | undefined;

function drawTool(c: Ctx, hx: number, hy: number, fm: number): void {
  c.save();
  c.translate(hx, hy);
  c.scale(fm, 1);
  c.rotate(fm * (A.ga + Math.PI / 2));
  tube(c, 0, 10.5, 0, -14.6, 1.9, WOOD); // cabo
  paintRRect(c, TIN, -1.6, -16.2, 3.2, 2.4, 0.7, 0.7); // virola de metal
  c.save();
  const isPickaxe = activeTool === 'pickaxe';
  paintPath(c, path => {
    path.beginPath();
    if (isPickaxe) {
      path.moveTo(-11, -9);
      path.quadraticCurveTo(0, -26, 12, -9);
      path.quadraticCurveTo(1, -18, -11, -9);
    } else {
      path.moveTo(-3, -17);
      path.lineTo(3, -17);
      path.lineTo(11, -22);
      path.quadraticCurveTo(15, -15, 11, -8);
      path.lineTo(3, -12);
      path.lineTo(-3, -12);
    }
    path.closePath();
  }, { ...STEEL, base: bladeColor ?? STEEL.base }, -11, -22, 25, 14, 0.9);
  c.restore();
  c.restore();
}

function armTubes(c: Ctx, sx: number, sy: number, hx: number, hy: number, far: boolean): void {
  const sl = far ? SHIRT_F : SHIRT;
  const dx = hx - sx;
  const dy = hy - sy;
  const mx = sx + dx * 0.5;
  const my = sy + dy * 0.5;
  const wx = sx + dx * 0.8;
  const wy = sy + dy * 0.8;
  tube(c, mx, my, wx, wy, 3.4, far ? SKIN_F : SKIN); // antebraço
  tube(c, sx, sy, mx, my, 4.7, sl); // manga
  tube(c, mx - dx * 0.05, my - dy * 0.05, mx + dx * 0.05, my + dy * 0.05, 5.2, sl); // dobra da manga
  tube(c, wx, wy, wx + (hx - wx) * 0.5, wy + (hy - wy) * 0.5, 3.9, far ? GLOVE_F : GLOVE); // punho da luva
}

function glove(c: Ctx, hx: number, hy: number, far: boolean): void {
  paintEllipse(c, far ? GLOVE_F : GLOVE, hx, hy, 2.5, 2.4, 0.8);
}

const TRAIL_N = 9;
const trTx = new Float32Array(TRAIL_N + 1);
const trTy = new Float32Array(TRAIL_N + 1);
const trMx = new Float32Array(TRAIL_N + 1);
const trMy = new Float32Array(TRAIL_N + 1);
let PX = 0;
let PY = 0;

/** Converte um ponto do referencial da foice para o referencial do desenho. */
function toolPt(lx: number, ly: number, fm: number): void {
  const psi = fm * (A.ga + Math.PI / 2);
  const cs = Math.cos(psi);
  const sn = Math.sin(psi);
  PX = (lx * cs - ly * sn) * fm;
  PY = lx * sn + ly * cs;
}

/** Rastro branco translúcido do arco da lâmina durante o corte. */
function drawTrail(c: Ctx, kf: readonly number[], sx: number, sy: number, mir: boolean, fm: number): void {
  const s = A.sw;
  const b = s < 0.5 ? s : 0.5;
  const a = Math.max(0.28, b - 0.2);
  const fade = s < 0.5 ? 1 : 1 - (s - 0.5) / 0.14;
  if (fade <= 0 || b - a < 0.01) return;
  for (let i = 0; i <= TRAIL_N; i++) {
    solveSwing(kf, a + ((b - a) * i) / TRAIL_N, mir);
    const hx = sx + ARM_L * Math.cos(A.th);
    const hy = sy + ARM_L * Math.sin(A.th);
    toolPt(19.6 * A.bs, -12.4, fm);
    trTx[i] = hx + PX;
    trTy[i] = hy + PY;
    toolPt(10.0 * A.bs, -15.2, fm);
    trMx[i] = hx + PX;
    trMy[i] = hy + PY;
  }
  solveSwing(kf, s, mir); // restaura o estado atual

  c.save();
  c.globalAlpha = 0.42 * fade;
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.moveTo(trTx[0], trTy[0]);
  for (let i = 1; i <= TRAIL_N; i++) c.lineTo(trTx[i], trTy[i]);
  for (let i = TRAIL_N; i >= 0; i--) c.lineTo(trMx[i], trMy[i]);
  c.closePath();
  c.fill();
  c.globalAlpha = 0.85 * fade;
  c.strokeStyle = "#ffffff";
  c.lineWidth = 1.1;
  c.beginPath();
  c.moveTo(trTx[0], trTy[0]);
  for (let i = 1; i <= TRAIL_N; i++) c.lineTo(trTx[i], trTy[i]);
  c.stroke();
  c.restore();
}

/** Braço que segura a foice + foice + rastro. Já dentro do translate do tronco. */
function toolArm(c: Ctx, kf: readonly number[], sx: number, sy: number, mir: boolean, fm: number, handDy: number): void {
  const s = A.sw;
  solveSwing(kf, s, mir);
  if (s > 0.3 && s < 0.64) drawTrail(c, kf, sx, sy, mir, fm);
  const hx = sx + ARM_L * Math.cos(A.th);
  const hy = sy + ARM_L * Math.sin(A.th) + (s === 0 ? handDy : 0);
  armTubes(c, sx, sy, hx, hy, false);
  drawTool(c, hx, hy, fm);
  glove(c, hx, hy, false);
}

// ============================================================================
// Cabeça e chapéu
// ============================================================================
function eyes(c: Ctx, x1: number, x2: number, y: number): void {
  if (A.blink) {
    c.strokeStyle = "#3a2418";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x1 - 0.9, y + 0.4);
    c.lineTo(x1 + 0.9, y + 0.4);
    if (x2 !== x1) {
      c.moveTo(x2 - 0.9, y + 0.4);
      c.lineTo(x2 + 0.9, y + 0.4);
    }
    c.stroke();
    return;
  }
  c.fillStyle = "#33201a";
  c.beginPath();
  c.ellipse(x1, y, 0.95, 1.35, 0, 0, TAU);
  c.fill();
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.ellipse(x1 - 0.3, y - 0.5, 0.36, 0.36, 0, 0, TAU);
  c.fill();
  if (x2 !== x1) {
    c.fillStyle = "#33201a";
    c.beginPath();
    c.ellipse(x2, y, 0.95, 1.35, 0, 0, TAU);
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.ellipse(x2 - 0.3, y - 0.5, 0.36, 0.36, 0, 0, TAU);
    c.fill();
  }
}

function mouth(c: Ctx, x: number, y: number, w: number): void {
  if (A.effort) {
    c.fillStyle = "#6b2f22";
    c.beginPath();
    c.ellipse(x, y + 0.1, w * 0.45, 0.95, 0, 0, TAU);
    c.fill();
  } else {
    c.strokeStyle = "#8a4630";
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(x, y - 0.6, w * 0.6, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
  }
}

function headFront(c: Ctx): void {
  paintEllipse(c, HAIR, 0, -27.6, 7.5, 7.0); // cabelo atrás
  paintEllipse(c, SKIN, -6.5, -25.6, 1.4, 1.8, 0.8); // orelhas
  paintEllipse(c, SKIN, 6.5, -25.6, 1.4, 1.8, 0.8);
  paintEllipse(c, SKIN, 0, -26.4, 6.3, 5.9); // rosto
  // sombra da aba na testa
  c.save();
  c.beginPath();
  c.ellipse(0, -26.4, 6.3, 5.9, 0, 0, TAU);
  c.clip();
  c.fillStyle = "rgba(80,40,16,0.30)";
  c.beginPath();
  c.ellipse(0, -28.6, 9, 3.1, 0, 0, TAU);
  c.fill();
  c.restore();
  // costeletas / mechas balançando
  const hs = A.hair * 0.35;
  paintEllipse(c, HAIR, -5.9 + hs, -24.9, 1.3, 2.6, 0.7);
  paintEllipse(c, HAIR, 5.9 + hs, -24.9, 1.3, 2.6, 0.7);
  // sobrancelhas
  c.strokeStyle = HAIR.dark;
  c.lineWidth = 0.75;
  c.beginPath();
  if (A.effort) {
    c.moveTo(-3.8, -27.5);
    c.lineTo(-1.4, -26.7);
    c.moveTo(3.8, -27.5);
    c.lineTo(1.4, -26.7);
  } else {
    c.moveTo(-3.8, -27.0);
    c.lineTo(-1.5, -27.3);
    c.moveTo(3.8, -27.0);
    c.lineTo(1.5, -27.3);
  }
  c.stroke();
  eyes(c, -2.5, 2.5, -25.0);
  // nariz sutil
  c.fillStyle = SKIN.dark;
  c.beginPath();
  c.ellipse(0, -23.3, 0.95, 0.75, 0, 0, TAU);
  c.fill();
  c.fillStyle = SKIN.light;
  c.beginPath();
  c.ellipse(-0.25, -23.6, 0.4, 0.3, 0, 0, TAU);
  c.fill();
  // bochechas
  c.fillStyle = "rgba(236,112,100,0.38)";
  c.beginPath();
  c.ellipse(-3.9, -22.9, 1.25, 0.8, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(3.9, -22.9, 1.25, 0.8, 0, 0, TAU);
  c.fill();
  mouth(c, 0, -21.7, 2.6);
}

function headBack(c: Ctx): void {
  paintEllipse(c, SKIN, -6.8, -25.6, 1.3, 1.7, 0.8); // orelhas espiando
  paintEllipse(c, SKIN, 6.8, -25.6, 1.3, 1.7, 0.8);
  paintEllipse(c, HAIR, 0, -27.3, 7.3, 6.8); // cabelo por trás
  // mecha da nuca balançando
  paintEllipse(c, HAIR, A.hair * 0.4, -21.6, 5.2, 1.9, 0.8);
  // redemoinho
  c.strokeStyle = HAIR.dark;
  c.lineWidth = 0.6;
  c.beginPath();
  c.arc(1.2, -25.2, 1.7, 0.4, 4.6);
  c.stroke();
}

function headSide(c: Ctx): void {
  paintEllipse(c, SKIN, 1.2, -26.3, 5.9, 5.8); // rosto
  paintEllipse(c, SKIN, 6.7, -25.0, 1.5, 1.3, 0.8); // nariz de perfil
  // sombra da aba
  c.save();
  c.beginPath();
  c.ellipse(1.2, -26.3, 5.9, 5.8, 0, 0, TAU);
  c.clip();
  c.fillStyle = "rgba(80,40,16,0.30)";
  c.beginPath();
  c.ellipse(2.5, -28.6, 8, 3.0, 0, 0, TAU);
  c.fill();
  c.restore();
  paintEllipse(c, HAIR, -3.6, -27.6, 5.0, 6.5); // cabelo (nuca/topo)
  paintEllipse(c, HAIR, 1.0 + A.hair * 0.25, -25.2, 1.1, 2.3, 0.7); // costeleta
  paintEllipse(c, SKIN, -1.2, -25.0, 1.5, 1.9, 0.8); // orelha
  c.fillStyle = SKIN.dark;
  c.beginPath();
  c.ellipse(-1.15, -24.9, 0.6, 0.95, 0, 0, TAU);
  c.fill();
  // sobrancelha, olho, bochecha, boca
  c.strokeStyle = HAIR.dark;
  c.lineWidth = 0.75;
  c.beginPath();
  if (A.effort) {
    c.moveTo(3.1, -27.7);
    c.lineTo(5.3, -27.0);
  } else {
    c.moveTo(3.1, -27.2);
    c.lineTo(5.3, -27.4);
  }
  c.stroke();
  eyes(c, 4.2, 4.2, -25.7);
  c.fillStyle = "rgba(236,112,100,0.38)";
  c.beginPath();
  c.ellipse(3.3, -23.2, 1.2, 0.8, 0, 0, TAU);
  c.fill();
  mouth(c, 4.7, -22.0, 2.2);
}

/** Fita amarrada no chapéu: dois segmentos por ponta para dar o balanço. */
function ribbons(c: Ctx, x: number, y: number, side: boolean): void {
  const d = side ? -1 : 0;
  paintEllipse(c, BAND, x - 1.3, y - 0.3, 1.7, 1.1, 0.7);
  paintEllipse(c, BAND, x + 1.3, y - 0.3, 1.7, 1.1, 0.7);
  const r1 = A.rib1;
  const r2 = A.rib2;
  const a1x = x - 0.5;
  const a1y = y + 0.4;
  const b1x = a1x - 0.6 + d * 0.5 + 1.8 * Math.sin(r1);
  const b1y = a1y + 3.2;
  const c1x = b1x - 0.3 + d * 0.6 + 2.0 * Math.sin(r1 + 0.9);
  const c1y = b1y + 2.8;
  tube(c, a1x, a1y, b1x, b1y, 1.2, BAND);
  tube(c, b1x, b1y, c1x, c1y, 1.0, BAND);
  const a2x = x + 0.5;
  const b2x = a2x + 0.6 + d * 0.5 + 1.8 * Math.sin(r2);
  const b2y = a1y + 2.8;
  const c2x = b2x + 0.3 + d * 0.6 + 2.0 * Math.sin(r2 + 0.9);
  const c2y = b2y + 2.4;
  tube(c, a2x, a1y, b2x, b2y, 1.2, BAND);
  tube(c, b2x, b2y, c2x, c2y, 1.0, BAND);
  paintEllipse(c, BAND, x, y + 0.1, 1.0, 1.0, 0.7); // nó
}

/** face: 0 frente, 1 costas, 2 lado. */
function drawHat(c: Ctx, face: number): void {
  const hx = face === 2 ? 0.6 : 0;
  c.save();
  c.translate(hx, 0);
  // aba larga
  paintEllipse(c, STRAW, 0, -33.2, 15, 4.6, 1.0);
  // trama de palha na aba: raios + anel
  c.strokeStyle = "#a96f2e";
  c.lineWidth = 0.45;
  c.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = (i * TAU) / 18;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    c.moveTo(ca * 7.6, -33.2 + sa * 2.5);
    c.lineTo(ca * 14.0, -33.2 + sa * 4.2);
  }
  c.stroke();
  c.strokeStyle = "#b8803a";
  c.beginPath();
  c.ellipse(0, -33.2, 11.2, 3.6, 0, 0, TAU);
  c.stroke();
  // copa
  paintPath(c, crownPath, STRAW, -8.3, -43, 16.6, 12.6, 1.0);
  c.strokeStyle = "#a96f2e";
  c.lineWidth = 0.45;
  c.beginPath();
  for (let i = -3; i <= 3; i++) {
    c.moveTo(i * 2.0, -34.6);
    c.quadraticCurveTo(i * 2.4, -39.5, i * 1.2, -42.2);
  }
  c.stroke();
  c.strokeStyle = STRAW.dark;
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(-3.8, -41.2);
  c.quadraticCurveTo(0, -39.8, 3.8, -41.2);
  c.stroke();
  // faixa de cor contrastante
  paintPath(c, bandPath, BAND, -7.7, -36.5, 15.4, 5.2, 0.8);
  if (face === 1) ribbons(c, 0, -34.2, false);
  else if (face === 2) ribbons(c, -7.2, -34.6, true);
  else {
    // frente: pequena fivela dourada na faixa
    paintRRect(c, GOLD, -1.3, -35.4, 2.6, 2.7, 0.6, 0.6);
  }
  c.restore();
}

// ============================================================================
// Pernas
// ============================================================================
function legFront(c: Ctx, side: number, ph: number, back: boolean): void {
  const s = Math.sin(ph);
  const lift = A.moving ? Math.max(0, Math.cos(ph)) * 1.9 : 0;
  const fy = (A.moving ? (back ? -s : s) * 1.1 : 0) - lift;
  const fx = side * 3.0;
  tube(c, side * 2.9 + A.ox, -9.4 + A.oy, fx, fy - 4.4, 4.8, PANTS);
  paintRRect(c, BOOT, fx - 3.2, fy - 5.0, 6.4, 5.2, 2.2);
  if (!back) {
    c.fillStyle = BOOT.dark; // sola
    c.fillRect(fx - 2.4, fy - 0.9, 4.8, 0.7);
  }
}

function legSide(c: Ctx, ph: number, far: boolean): void {
  const s = Math.sin(ph);
  const fx = A.moving ? s * 4.4 : far ? -1.2 : 1.2;
  const lift = A.moving ? Math.max(0, Math.cos(ph)) * 2.6 : 0;
  tube(c, 0.2 + A.ox, -9.4 + A.oy, fx, -4.6 - lift, 4.8, far ? PANTS_F : PANTS);
  const bt = far ? BOOT_F : BOOT;
  paintRRect(c, bt, fx - 3.2, -4.9 - lift, 8.2, 5.0, 2.2);
  c.strokeStyle = bt.line;
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(fx - 2.4, -1.0 - lift);
  c.lineTo(fx + 4.2, -1.0 - lift);
  c.stroke();
}

// ============================================================================
// VISTA DE FRENTE ("down")
// ============================================================================
let packFill = 0;
let packOpen = 0;
const visibleCargo: ResourceId[] = [];

function packCompartment(c: Ctx, x: number, y: number, width: number, height: number): void {
  paintRRect(c, PACK, x, y, width, height, 4.2);
  const opening = 7 * packOpen;
  if (opening > 0.25) {
    const innerX = x + 1;
    const innerWidth = width - 2;
    const innerY = y + 0.6;
    rr(c, innerX, innerY, innerWidth, opening, Math.min(2, opening / 2));
    c.fillStyle = '#54301c';
    c.fill();
    c.save();
    c.clip();
    const iconScale = Math.min(0.48, innerWidth / Math.max(16, visibleCargo.length * 10));
    for (let i = 0; i < visibleCargo.length; i++) {
      c.save();
      c.translate(innerX + innerWidth * (i + 0.5) / visibleCargo.length, innerY + opening * 0.56);
      c.rotate(i % 2 ? 0.2 : -0.15);
      c.scale(iconScale, iconScale);
      drawResourceIcon(c, visibleCargo[i]);
      c.restore();
    }
    c.restore();
    c.fillStyle = PACK.light;
    c.fillRect(innerX + 1, innerY + opening - 0.65, innerWidth - 2, 0.65);
  }

  const flapHeight = 6.4 - 3.5 * packOpen;
  paintRRect(c, PACK2, x, y - 2.4 * packOpen, width, flapHeight, Math.min(3, flapHeight / 2));
}

function packFront(c: Ctx): void {
  const sw = A.moving ? Math.sin(A.p) * 0.4 : 0;
  c.save();
  c.translate(sw, 0);
  // Vista de frente: a lateral da bolsa aparece atrás do ombro livre.
  packCompartment(c, -8.8 + packFill * 5, -24.3, 17.6 + packFill * 2.6, 12.3 + packFill * 2);
  paintRRect(c, ROLL, -9.8, -12.8, 19.6, 4.8, 2.4);
  c.fillStyle = PACK.dark;
  c.fillRect(-6.8, -12.8, 1.6, 4.8);
  c.fillRect(5.2, -12.8, 1.6, 4.8);
  c.restore();
}

function torsoFront(c: Ctx): void {
  paintRRect(c, SHIRT, -7.2, -21.6, 14.4, 12.4, 3.6);
  // gola em V
  c.beginPath();
  c.moveTo(-2.8, -21.4);
  c.lineTo(2.8, -21.4);
  c.lineTo(0, -17.2);
  c.closePath();
  c.fillStyle = SKIN.base;
  c.fill();
  c.strokeStyle = SKIN.line;
  c.lineWidth = 0.7;
  c.stroke();
  // colete de couro
  K = 1;
  paintPath(c, vestPath, VEST, 1.5, -21.4, 5.7, 11.6);
  K = -1;
  paintPath(c, vestPath, VEST, -7.2, -21.4, 5.7, 11.6);
  c.strokeStyle = VEST.dark;
  c.lineWidth = 0.6;
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const yy = -15.6 + i * 2.5;
    c.moveTo(-1.5, yy);
    c.lineTo(1.5, yy + 0.5);
  }
  c.stroke();
  // cinto + fivela
  paintRRect(c, BELT, -7.4, -11.7, 14.8, 2.6, 1.0);
  paintRRect(c, GOLD, -1.6, -12.0, 3.2, 3.2, 0.8, 0.7);
  c.fillStyle = BELT.dark;
  c.fillRect(-0.6, -11.0, 1.2, 1.2);
  // bolsinho balançando
  c.save();
  c.translate(5.0, -11.2);
  c.rotate(A.pouch);
  paintRRect(c, POUCH, -2.0, 0.2, 4.2, 4.6, 1.2, 0.8);
  c.strokeStyle = POUCH.line;
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(-1.8, 1.9);
  c.lineTo(2.0, 1.9);
  c.stroke();
  c.fillStyle = GOLD.base;
  c.fillRect(-0.2, 1.7, 0.7, 0.9);
  c.restore();
}

function drawFront(c: Ctx): void {
  c.save();
  c.translate(A.ox, A.oy);
  packFront(c);
  c.restore();
  legFront(c, -1, A.p, false);
  legFront(c, 1, A.p + Math.PI, false);
  c.save();
  c.translate(A.ox, A.oy);
  torsoFront(c);
  // braço livre (lado direito da tela)
  const fdy = A.moving ? 1.5 * Math.sin(A.p) : 0;
  armTubes(c, 7.0, -19.2, 8.4, -10.9 + fdy, false);
  glove(c, 8.4, -10.9 + fdy, false);
  headFront(c);
  drawHat(c, 0);
  // braço da foice (lado esquerdo da tela)
  toolArm(c, KF_FRONT, -7.0, -19.2, false, -1, A.moving ? 1.5 * Math.sin(A.p + Math.PI) : 0);
  c.restore();
}

// ============================================================================
// VISTA DE COSTAS ("up")
// ============================================================================
function packBack(c: Ctx): void {
  const sw = A.moving ? Math.sin(A.p) * 0.5 : 0;
  c.save();
  c.translate(sw, 0);
  const bulk = packFill * 4.4;
  packCompartment(c, -7.9 - bulk / 2, -22.6 - packFill * 0.4, 15.8 + bulk, 10.8 + packFill * 2.8);
  // tiras com fivela
  c.fillStyle = PACK.line;
  const strapY = -20.6 + packOpen * 3.7;
  c.fillRect(-3.9, strapY, 1.9, 7.8 - packOpen * 3.7);
  c.fillRect(2.0, strapY, 1.9, 7.8 - packOpen * 3.7);
  paintRRect(c, GOLD, -4.1, strapY + 1.8, 2.3, 1.9, 0.5, 0.6);
  paintRRect(c, GOLD, 1.8, strapY + 1.8, 2.3, 1.9, 0.5, 0.6);
  // rolo de dormir na base da mochila
  paintRRect(c, ROLL, -9.6, -12.6, 19.2, 4.8, 2.4);
  c.fillStyle = TEAL.base;
  c.fillRect(-7.6, -10.9, 15.2, 1.3);
  c.fillStyle = PACK.dark;
  c.fillRect(-6.2, -12.6, 1.7, 4.8);
  c.fillRect(4.5, -12.6, 1.7, 4.8);
  // caneca de lata pendurada
  c.save();
  c.translate(-5.0, -19.0);
  c.rotate(A.mug);
  c.strokeStyle = PACK.line;
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, 1.6);
  c.stroke();
  paintRRect(c, TIN, -1.9, 1.4, 3.8, 4.4, 0.9, 0.8);
  c.strokeStyle = TIN.line;
  c.lineWidth = 0.8;
  c.beginPath();
  c.arc(1.9, 3.6, 1.4, -1.2, 1.2);
  c.stroke();
  c.fillStyle = TIN.light;
  c.fillRect(-1.5, 1.7, 3.0, 0.7);
  c.restore();
  c.restore();
}

function drawBack(c: Ctx): void {
  legFront(c, -1, A.p, true);
  legFront(c, 1, A.p + Math.PI, true);
  c.save();
  c.translate(A.ox, A.oy);
  // braço livre (esquerdo do personagem = esquerda da tela), atrás da mochila
  const fdy = A.moving ? -1.5 * Math.sin(A.p + Math.PI) : 0;
  armTubes(c, -7.6, -19.2, -9.0, -10.9 + fdy, false);
  glove(c, -9.0, -10.9 + fdy, false);
  headBack(c);
  packBack(c);
  drawHat(c, 1);
  toolArm(c, KF_FRONT, 7.6, -19.2, true, 1, A.moving ? -1.5 * Math.sin(A.p) : 0);
  c.restore();
}

// ============================================================================
// VISTA DE LADO ("right"; "left" é o espelho)
// ============================================================================
function packSide(c: Ctx): void {
  c.save();
  c.translate(-8.3, -24.5); // pivô no topo da mochila
  c.rotate(A.pack);
  c.translate(8.3, 24.5);
  // caneca pendurada atrás
  c.save();
  c.translate(-13.2 - 5 * packFill, -18.0);
  c.rotate(A.mug);
  c.strokeStyle = PACK.line;
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(-0.2, 1.6);
  c.stroke();
  paintRRect(c, TIN, -3.6, 1.3, 3.8, 4.4, 0.9, 0.8);
  c.fillStyle = TIN.light;
  c.fillRect(-3.2, 1.6, 3.0, 0.7);
  c.restore();
  // corpo da mochila
  packCompartment(c, -13 - 5 * packFill, -25.6, 9.6 + 5 * packFill, 14 + 2.4 * packFill);
  paintRRect(c, PACK2, -11.6, -17.4, 6.4, 4.6, 1.6, 0.8); // bolso lateral
  c.fillStyle = PACK.line;
  c.fillRect(-9.2, -19.4, 1.7, 4.0);
  paintRRect(c, GOLD, -9.4, -17.4, 2.1, 1.7, 0.5, 0.6);
  // rolo de dormir (visto de topo: um círculo com espiral)
  paintEllipse(c, ROLL, -8.2, -10.6, 3.6, 3.6, 0.9);
  c.strokeStyle = ROLL.line;
  c.lineWidth = 0.6;
  c.beginPath();
  c.arc(-8.2, -10.6, 2.1, 0.3, 5.3);
  c.stroke();
  c.beginPath();
  c.arc(-8.2, -10.6, 0.9, 0.8, 5.6);
  c.stroke();
  c.strokeStyle = TEAL.base;
  c.lineWidth = 0.9;
  c.beginPath();
  c.arc(-8.2, -10.6, 3.0, 2.2, 4.3);
  c.stroke();
  c.restore();
}

function torsoSide(c: Ctx): void {
  paintRRect(c, SHIRT, -4.8, -21.6, 9.6, 12.4, 3.4);
  paintRRect(c, VEST, -4.9, -21.4, 8.4, 11.6, 3.2);
  // alça da mochila sobre o ombro
  tube(c, -3.0, -22.2, 0.8, -21.6, 2.0, PACK2);
  tube(c, 0.8, -21.6, 1.6, -16.2, 2.0, PACK2);
  // cinto, fivela, bolsinho
  paintRRect(c, BELT, -5.0, -11.7, 10.0, 2.6, 1.0);
  paintRRect(c, GOLD, 3.2, -12.0, 2.2, 3.2, 0.6, 0.7);
  c.save();
  c.translate(-0.6, -11.2);
  c.rotate(A.pouch);
  paintRRect(c, POUCH, -2.2, 0.2, 4.4, 4.6, 1.2, 0.8);
  c.strokeStyle = POUCH.line;
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(-2.0, 1.9);
  c.lineTo(2.0, 1.9);
  c.stroke();
  c.restore();
}

function drawSide(c: Ctx): void {
  c.save();
  c.translate(A.ox, A.oy);
  // braço de trás (esquerdo do personagem)
  const farTh = (A.moving ? 88 + 26 * Math.sin(A.p) : 88 + 2 * Math.sin(A.p * 0.5)) * DEG;
  const fhx = 0.5 + 8.4 * Math.cos(farTh);
  const fhy = -19.2 + 8.4 * Math.sin(farTh);
  armTubes(c, 0.5, -19.2, fhx, fhy, true);
  glove(c, fhx, fhy, true);
  packSide(c);
  c.restore();
  legSide(c, A.p + Math.PI, true);
  legSide(c, A.p, false);
  c.save();
  c.translate(A.ox, A.oy);
  torsoSide(c);
  headSide(c);
  drawHat(c, 2);
  toolArm(c, KF_SIDE, 0.5, -19.2, false, 1, 0);
  c.restore();
}

// ============================================================================
// API pública
// ============================================================================
function drawShadow(c: Ctx, f: Facing): void {
  const side = f === "left" || f === "right";
  const cx = f === "right" ? -0.2 : f === "left" ? 2.4 : 1.0;
  c.fillStyle = "rgba(20,32,12,0.30)";
  c.beginPath();
  c.ellipse(cx, 0.8, (side ? 11.5 : 10.5) - A.bob * 0.4, 3.7, 0, 0, TAU);
  c.fill();
}

/**
 * Desenha o personagem.
 * (x, y) = ponto dos pés, no centro do contato com o chão.
 */
export function drawPlayer(ctx: Ctx, x: number, y: number, pose: PlayerPose, opts?: DrawOptions): void {
  const scale = opts !== undefined && opts.scale !== undefined ? opts.scale : 1;
  const shadow = opts !== undefined && opts.shadow !== undefined ? opts.shadow : true;
  activeTool = pose.tool;
  bladeColor = pose.bladeColor;
  packFill = pose.packFill ?? 0;
  packOpen = pose.packOpen ?? 0;
  visibleCargo.length = 0;
  if (packOpen > 0.03 && pose.cargo) {
    for (const resource of pose.cargo) {
      if (!visibleCargo.includes(resource)) visibleCargo.push(resource);
      if (visibleCargo.length === 3) break;
    }
  }
  animate(pose);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (shadow) drawShadow(ctx, pose.facing);
  if (pose.facing === "left") ctx.scale(-1, 1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pose.facing === "down") drawFront(ctx);
  else if (pose.facing === "up") drawBack(ctx);
  else drawSide(ctx);
  ctx.restore();
}

//
