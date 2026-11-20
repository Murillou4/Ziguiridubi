import { drawIronOreDrop, drawIronOrePile } from './world-iron-ore.ts';
/**
 * world-drops.ts — Visual dos drops de recurso (itens soltos no chão)
 *
 * Cada recurso tem uma silhueta própria (tora, tábuas, pedra, minério, lingote,
 * engrenagem, núcleo a vapor, cristal, relíquia, pergaminho e moeda), todas
 * desenhadas proceduralmente em ~14–18px de largura, no estilo cozy do terreno:
 * cantos arredondados, brilhos suaves e cores quentes.
 *
 * Só apresentação: não mexe em física nem em GatheringSystem.
 *
 * Regras de performance (mesmas de world-trees.ts / world-props.ts):
 *  - sem `new`, arrays ou concatenação de strings dentro do loop de desenho;
 *  - paletas (claro/escuro) calculadas UMA vez por recurso e cacheadas;
 *  - tabelas de pontos pré-computadas em Float32Array no carregamento do módulo;
 *  - um único ctx.save()/restore() por drop, respeitando o globalAlpha do chamador.
 */

import { RESOURCES } from '../config/resources.ts';
import type { ResourceId } from '../domain/types.ts';

type Ctx = CanvasRenderingContext2D;

/** Retângulo visível da câmera, em coordenadas de mundo (o `view` do CanvasRenderer). */
import type { ViewRect } from './world-terrain.ts';

interface ResDef {
  color: string;
  tier?: number;
}

interface Palette {
  base: string;
  light: string;
  dark: string;
  tier: number;
}

type DrawFn = (ctx: Ctx, p: Palette, time: number, phase: number) => void;

interface DropShape {
  draw: DrawFn;
  /** Distância (px, coordenadas locais) do centro do desenho até a base: é o ponto que toca o chão. */
  bottom: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de ajuste fino
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const INV_TAU = 1 / TAU;
const INV_1024 = 1 / 1024;

const CONTACT = 6; // px abaixo de (x, y) onde a base do sprite toca o chão
const SHADOW_RX = 6.8;
const SHADOW_ALPHA = 0.3;

const BOB_AMP = 2.2; // amplitude da flutuação no chão (px)
const BOB_SPEED = 2.6; // rad/s

const TILT_PER_VX = 0.004; // rad por unidade de vx (ajustar à escala de velocidade do jogo)
const TILT_MAX = 0.55;

const LAND_TIME = 0.15; // duração do pulinho ao tocar o chão (s)
const LAND_SQUASH = 0.3; // intensidade do squash & stretch
const LAND_HOP = 2.5; // altura do pulinho (px)

const SPARK_WINDOW = 0.3; // fração do ciclo em que a estrelinha fica visível
const CULL_MARGIN = 26; // folga p/ sombra, halo e vapor ao cortar fora da tela

// Cores fixas (acentos que não vêm de RESOURCES)
const EDGE_LIGHT = '#fffbeb';
const EDGE_DARK = 'rgba(44,30,18,0.30)';
const SHADOW_COLOR = '#2c1e12';
const SPARK_FILL = '#fffef5';
const SPARK_GLOW = '#fff2b8';
const SPARK_EDGE = 'rgba(120,80,30,0.35)';
const LEAF = '#7bc96f';
const LEAF_DARK = '#4a9447';
const BRASS = '#e8c27a';
const GOLD = '#f5d27a';
const WARM_BAND = '#f1c98b';
const NAIL = '#eef1f5';
const WHITE = '#ffffff';
const VAPOR = '#eef7ff';
const VAPOR_EDGE = 'rgba(52,72,104,0.22)';
const COIN_FONT = '700 7.5px system-ui, sans-serif';

// Alvos de mistura p/ tons derivados de RESOURCES[id].color (quentes, não cinza puro)
const LIGHT_TARGET = [255, 246, 224];
const DARK_TARGET = [58, 36, 28];

// ─────────────────────────────────────────────────────────────────────────────
// Tabelas pré-computadas
// ─────────────────────────────────────────────────────────────────────────────

// Engrenagem: 8 dentes, 4 pontos por dente (base, topo, topo, base)
const GEAR_TEETH = 8;
const GEAR_R1 = 5.2;
const GEAR_R2 = 7.4;
const GEAR_PTS = (() => {
  const pts = new Float32Array(GEAR_TEETH * 4 * 2);
  const off = [-0.3, -0.17, 0.17, 0.3];
  const rad = [GEAR_R1, GEAR_R2, GEAR_R2, GEAR_R1];
  let k = 0;
  for (let i = 0; i < GEAR_TEETH; i++) {
    const a = (i * TAU) / GEAR_TEETH;
    for (let j = 0; j < 4; j++) {
      pts[k++] = Math.cos(a + off[j]) * rad[j];
      pts[k++] = Math.sin(a + off[j]) * rad[j];
    }
  }
  return pts;
})();

// Estrelinha de 4 pontas (8 vértices unitários)
const STAR = (() => {
  const pts = new Float32Array(16);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : 0.26;
    pts[i * 2] = Math.cos(a) * r;
    pts[i * 2 + 1] = Math.sin(a) * r;
  }
  return pts;
})();

// 3 posições possíveis da estrelinha (coordenadas locais do sprite)
const SPARK_X = new Float32Array([-4.6, 4.4, 0.6]);
const SPARK_Y = new Float32Array([-3.8, -1.6, -6]);

// Lingote
const INGOT_BODY = new Float32Array([-5.5, -4, 5.5, -4, 8, 5.5, -8, 5.5]);
const INGOT_TOP = new Float32Array([-5, -3.2, 5, -3.2, 6.4, 0.2, -6.4, 0.2]);
const INGOT_FRONT_SHADE = new Float32Array([-7.6, 3.6, 7.6, 3.6, 8, 5.5, -8, 5.5]);
const INGOT_GLINT = new Float32Array([-1, -3.4, 1.8, -3.4, -0.6, 5, -3.4, 5]);

// Cristal de éter
const CR_HEX = new Float32Array([0, -8.8, 6.8, -3.4, 5.4, 4.6, 0, 8.6, -5.4, 4.6, -6.8, -3.4]);
const CR_TOP = new Float32Array([0, -8.8, 6.8, -3.4, 0, -1.2, -6.8, -3.4]);
const CR_LEFT = new Float32Array([-6.8, -3.4, 0, -1.2, 0, 8.6, -5.4, 4.6]);
const CR_RIGHT = new Float32Array([6.8, -3.4, 0, -1.2, 0, 8.6, 5.4, 4.6]);

// Gema da relíquia
const RELIC_GEM = new Float32Array([0, -1, 2.4, 1.6, 0, 4.2, -2.4, 1.6]);

// Momento (age) em que cada drop tocou o chão, indexado por seed & 1023.
// Evita precisar de campo novo em DropItem; colisões de slot só afetam o pulinho (visual).
const LAND_AT = new Float32Array(1024).fill(-1);

// ─────────────────────────────────────────────────────────────────────────────
// Estado de módulo reutilizado (sem alocação por frame)
// ─────────────────────────────────────────────────────────────────────────────

const RES = RESOURCES as unknown as Record<string, ResDef | undefined>;
const PALETTES: Record<string, Palette | undefined> = {};
let curAlpha = 1; // globalAlpha do chamador, lido no início de cada drop
let seedCounter = 0;

/**
 * Gera uma seed estável para um drop novo (use em GatheringSystem ou no
 * primeiro render). Os 10 bits baixos percorrem todos os valores em sequência,
 * então drops vizinhos nunca ficam com a mesma fase de animação.
 */
export function nextDropSeed(): number {
  seedCounter = (seedCounter + 0x9e3779b1) >>> 0;
  return seedCounter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cores (calculadas uma vez por recurso)
// ─────────────────────────────────────────────────────────────────────────────

function toRgb(hex: string): number[] {
  let h = hex.charAt(0) === '#' ? hex.slice(1) : '';
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  const n = h.length === 6 ? parseInt(h, 16) : NaN;
  if (isNaN(n)) return [180, 180, 180];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixTo(rgb: number[], target: number[], t: number): string {
  const r = Math.round(rgb[0] + (target[0] - rgb[0]) * t);
  const g = Math.round(rgb[1] + (target[1] - rgb[1]) * t);
  const b = Math.round(rgb[2] + (target[2] - rgb[2]) * t);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function buildPalette(color: string, tier: number): Palette {
  const rgb = toRgb(color);
  return {
    base: color,
    light: mixTo(rgb, LIGHT_TARGET, 0.5),
    dark: mixTo(rgb, DARK_TARGET, 0.42),
    tier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de desenho
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** Aplica alpha relativo ao globalAlpha do chamador. */
function setA(ctx: Ctx, a: number): void {
  ctx.globalAlpha = curAlpha * a;
}

/** Retângulo arredondado (subpath). */
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Elipse como subpath independente (moveTo evita linha perdida entre subpaths). */
function ell(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot: number): void {
  ctx.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot));
  ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
}

function circ(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.moveTo(cx + r, cy);
  ctx.arc(cx, cy, r, 0, TAU);
}

function poly(ctx: Ctx, pts: Float32Array): void {
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/**
 * Contorno claro (~1.3px por fora) + halo escuro suave (~1.9px) para destacar o
 * item sobre grama, terra e ponte, e então preenche o path atual.
 * `k` reduz a espessura do contorno em detalhes pequenos (folhas).
 */
function paint(ctx: Ctx, fill: string, k: number, evenodd: boolean): void {
  setA(ctx, 1);
  ctx.lineWidth = 3.8 * k;
  ctx.strokeStyle = EDGE_DARK;
  ctx.stroke();
  ctx.lineWidth = 2.6 * k;
  ctx.strokeStyle = EDGE_LIGHT;
  ctx.stroke();
  ctx.fillStyle = fill;
  if (evenodd) ctx.fill('evenodd');
  else ctx.fill();
}

function strokeA(ctx: Ctx, color: string, width: number, alpha: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  setA(ctx, alpha);
  ctx.stroke();
  setA(ctx, 1);
}

function fillA(ctx: Ctx, color: string, alpha: number): void {
  ctx.fillStyle = color;
  setA(ctx, alpha);
  ctx.fill();
  setA(ctx, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Silhuetas (coordenadas locais, centradas em ~0,0)
// ─────────────────────────────────────────────────────────────────────────────

/** wood — toquinho/tora curta com anel de crescimento e um brotinho */
function drawWood(ctx: Ctx, p: Palette, time: number, phase: number): void {
  // corpo + tampa num contorno só
  ctx.beginPath();
  rr(ctx, -7.5, -3.5, 13, 9, 3.2);
  ell(ctx, 5.5, 1, 2.6, 4.5, 0);
  paint(ctx, p.base, 1, false);

  // sulcos da casca e brilho
  ctx.beginPath();
  ctx.moveTo(-5.5, -0.6);
  ctx.lineTo(1.2, -0.6);
  ctx.moveTo(-5, 3.2);
  ctx.lineTo(0.4, 3.2);
  strokeA(ctx, p.dark, 0.9, 0.55);
  ctx.beginPath();
  ctx.moveTo(-5.2, -2.2);
  ctx.lineTo(1.5, -2.2);
  strokeA(ctx, p.light, 1, 0.5);

  // tampa com anéis de crescimento
  ctx.beginPath();
  ell(ctx, 5.5, 1, 2.6, 4.5, 0);
  ctx.fillStyle = p.light;
  ctx.fill();
  strokeA(ctx, p.dark, 0.8, 0.6);
  ctx.beginPath();
  ell(ctx, 5.5, 1, 1.3, 2.6, 0);
  strokeA(ctx, p.dark, 0.7, 0.5);
  ctx.beginPath();
  circ(ctx, 5.5, 1, 0.55);
  fillA(ctx, p.dark, 0.7);

  // brotinho de folha balançando
  const sway = Math.sin(time * 2 + phase) * 0.15;
  ctx.beginPath();
  ctx.moveTo(-3, -3.2);
  ctx.lineTo(-3.3, -6.4);
  strokeA(ctx, EDGE_LIGHT, 2.6, 1);
  strokeA(ctx, LEAF_DARK, 1.1, 1);
  ctx.beginPath();
  ell(ctx, -5.3, -7.1, 2.5, 1.3, -0.5 + sway);
  ell(ctx, -1.7, -7.6, 2.5, 1.3, 0.5 + sway);
  paint(ctx, LEAF, 0.55, false);
}

/** planks — 2 tábuas empilhadas com veios e pregos */
function drawPlanks(ctx: Ctx, p: Palette): void {
  ctx.beginPath();
  rr(ctx, -7.5, 0, 15, 5.4, 1.7);
  rr(ctx, -6.3, -5.8, 14, 5.4, 1.7);
  paint(ctx, p.base, 1, false);

  // tábua de cima, mais clara
  ctx.beginPath();
  rr(ctx, -6.3, -5.8, 14, 5.4, 1.7);
  ctx.fillStyle = p.light;
  ctx.fill();
  strokeA(ctx, p.dark, 0.8, 0.45);

  // veios
  ctx.beginPath();
  ctx.moveTo(-4.4, -4.1);
  ctx.lineTo(0.8, -4.1);
  ctx.moveTo(2.2, -2.3);
  ctx.lineTo(5.6, -2.3);
  ctx.moveTo(-6, 1.8);
  ctx.lineTo(-1.6, 1.8);
  ctx.moveTo(0, 3.6);
  ctx.lineTo(5.4, 3.6);
  strokeA(ctx, p.dark, 0.8, 0.5);

  // pregos
  ctx.beginPath();
  circ(ctx, -4.9, -3.1, 0.85);
  circ(ctx, 5.4, -3.1, 0.85);
  circ(ctx, -6, 2.7, 0.85);
  circ(ctx, 6, 2.7, 0.85);
  ctx.fillStyle = NAIL;
  ctx.fill();
  strokeA(ctx, p.dark, 0.5, 0.5);
}

/** stone — pedrinha arredondada com faceta clara e rachadura sutil */
function drawStone(ctx: Ctx, p: Palette): void {
  // sombra interna (crescente escura embaixo/direita)
  ctx.beginPath();
  ell(ctx, 0.4, 1.2, 7.6, 6.2, -0.12);
  paint(ctx, p.dark, 1, false);
  ctx.beginPath();
  ell(ctx, -0.6, 0.2, 6.8, 5.4, -0.12);
  ctx.fillStyle = p.base;
  ctx.fill();

  // faceta clara
  ctx.beginPath();
  ell(ctx, -2.6, -2.1, 3.1, 1.8, -0.5);
  fillA(ctx, p.light, 0.8);

  // rachadura
  ctx.beginPath();
  ctx.moveTo(1.6, -3.3);
  ctx.lineTo(0.6, -0.8);
  ctx.lineTo(2.4, 0.8);
  ctx.lineTo(1.6, 3);
  strokeA(ctx, p.dark, 0.9, 0.55);
}

/** ironIngot — lingote trapezoidal com reflexo diagonal */
function drawIronIngot(ctx: Ctx, p: Palette, time: number, phase: number): void {
  ctx.beginPath();
  poly(ctx, INGOT_BODY);
  paint(ctx, p.base, 1, false);

  ctx.beginPath();
  poly(ctx, INGOT_FRONT_SHADE);
  fillA(ctx, p.dark, 0.35);

  ctx.beginPath();
  poly(ctx, INGOT_TOP);
  ctx.fillStyle = p.light;
  ctx.fill();
  strokeA(ctx, p.dark, 0.7, 0.4);

  ctx.beginPath();
  poly(ctx, INGOT_GLINT);
  fillA(ctx, WHITE, 0.35 + 0.15 * Math.sin(time * 1.6 + phase));
}

/** gears — engrenagem de 8 dentes com furo central, girando devagar */
function drawGears(ctx: Ctx, p: Palette, time: number, phase: number): void {
  const ang = time * 0.9 + phase;
  ctx.rotate(ang);
  ctx.beginPath();
  poly(ctx, GEAR_PTS);
  circ(ctx, 0, 0, 3); // furo (evenodd)
  paint(ctx, p.base, 1, true);
  ctx.beginPath();
  circ(ctx, 0, 0, 4.3);
  strokeA(ctx, p.dark, 0.9, 0.4);
  ctx.rotate(-ang); // o brilho não gira junto: a luz vem sempre do mesmo lado
  ctx.beginPath();
  ctx.arc(0, 0, 6.1, 3.5, 4.7);
  strokeA(ctx, p.light, 1.2, 0.85);
}

/** steamCore — esfera azul com anel de latão e vapor subindo */
function drawSteamCore(ctx: Ctx, p: Palette, time: number, phase: number): void {
  ctx.beginPath();
  circ(ctx, 0, 1.2, 6.4);
  paint(ctx, p.dark, 1, false);
  ctx.beginPath();
  circ(ctx, -0.7, 0.4, 5.4);
  ctx.fillStyle = p.base;
  ctx.fill();
  ctx.beginPath();
  ell(ctx, -2.4, -1.5, 1.8, 1.1, -0.6);
  fillA(ctx, WHITE, 0.75);

  // anel
  ctx.beginPath();
  ell(ctx, 0, 1.4, 8.2, 2.6, -0.28);
  strokeA(ctx, EDGE_DARK, 2.8, 1);
  strokeA(ctx, BRASS, 1.5, 1);

  // vapor: 3 baforadas em fases diferentes
  const ph = phase * INV_TAU;
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.55 + ph + i / 3) % 1;
    const px = Math.sin(t * 5 + i * 2.1 + phase) * 1.9;
    const py = -5.5 - t * 9;
    const r = 1.1 + t * 1.9;
    const a = Math.sin(t * Math.PI) * 0.62;
    ctx.beginPath();
    circ(ctx, px, py, r);
    fillA(ctx, VAPOR, a);
    strokeA(ctx, VAPOR_EDGE, 0.8, a);
  }
}

/** etherCryst — cristal facetado roxo com brilho pulsante */
function drawEtherCryst(ctx: Ctx, p: Palette, time: number, phase: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.4 + phase);

  ctx.beginPath();
  circ(ctx, 0, 0, 9 + pulse * 1.5);
  fillA(ctx, p.light, 0.1 + 0.12 * pulse);

  ctx.beginPath();
  poly(ctx, CR_HEX);
  paint(ctx, p.base, 1, false);

  ctx.beginPath();
  poly(ctx, CR_TOP);
  ctx.fillStyle = p.light;
  ctx.fill();
  ctx.beginPath();
  poly(ctx, CR_RIGHT);
  ctx.fillStyle = p.dark;
  ctx.fill();

  // arestas
  ctx.beginPath();
  ctx.moveTo(-6.8, -3.4);
  ctx.lineTo(0, -1.2);
  ctx.lineTo(6.8, -3.4);
  ctx.moveTo(0, -1.2);
  ctx.lineTo(0, 8.6);
  strokeA(ctx, WHITE, 0.7, 0.55);

  // pulso de brilho
  ctx.beginPath();
  poly(ctx, CR_HEX);
  fillA(ctx, WHITE, pulse * 0.28);
  ctx.beginPath();
  ell(ctx, -2.2, -5, 1.1, 2.2, 0.5);
  fillA(ctx, WHITE, 0.55 + 0.3 * pulse);
}

/** relic — amuleto rosa com argola, gema e aura pulsante */
function drawRelic(ctx: Ctx, p: Palette, time: number, phase: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 2 + phase);

  // aura
  ctx.beginPath();
  circ(ctx, 0, 0.6, 11 + pulse * 1.6);
  fillA(ctx, p.light, 0.1 + 0.07 * pulse);
  ctx.beginPath();
  circ(ctx, 0, 0.6, 8.2);
  fillA(ctx, p.light, 0.16);

  // argola
  ctx.beginPath();
  circ(ctx, 0, -6, 2.1);
  strokeA(ctx, EDGE_LIGHT, 2.9, 1);
  strokeA(ctx, GOLD, 1.3, 1);

  // medalhão
  ctx.beginPath();
  circ(ctx, 0, 1.6, 5.8);
  paint(ctx, p.base, 1, false);
  ctx.beginPath();
  circ(ctx, 0, 1.6, 4.2);
  strokeA(ctx, GOLD, 1, 0.95);

  // gema central
  ctx.beginPath();
  poly(ctx, RELIC_GEM);
  ctx.fillStyle = p.light;
  ctx.fill();
  strokeA(ctx, p.dark, 0.7, 0.7);
  ctx.beginPath();
  poly(ctx, RELIC_GEM);
  fillA(ctx, WHITE, pulse * 0.45);

  ctx.beginPath();
  ctx.arc(0, 1.6, 5, 3.7, 4.6);
  strokeA(ctx, WHITE, 1.1, 0.8);
}

/** blueprints — pergaminho enrolado azul com linhas de projeto */
function drawBlueprints(ctx: Ctx, p: Palette): void {
  ctx.beginPath();
  rr(ctx, -6.5, -4.2, 13, 8.4, 2.2);
  ell(ctx, 6.5, 0, 1.8, 4.2, 0);
  ell(ctx, -6.5, 0, 1.8, 4.2, 0);
  paint(ctx, p.base, 1, false);

  // pontas do rolo
  ctx.beginPath();
  ell(ctx, 6.5, 0, 1.8, 4.2, 0);
  ell(ctx, -6.5, 0, 1.8, 4.2, 0);
  ctx.fillStyle = p.light;
  ctx.fill();
  strokeA(ctx, p.dark, 0.8, 0.55);
  ctx.beginPath();
  ell(ctx, 6.5, 0, 0.8, 2.1, 0);
  ell(ctx, -6.5, 0, 0.8, 2.1, 0);
  strokeA(ctx, p.dark, 0.7, 0.5);

  // brilho de cima
  ctx.beginPath();
  ctx.moveTo(-5, -2.9);
  ctx.lineTo(5, -2.9);
  strokeA(ctx, p.light, 1, 0.5);

  // linhas do projeto + compasso
  ctx.beginPath();
  ctx.moveTo(-4.2, -1.2);
  ctx.lineTo(1.4, -1.2);
  ctx.moveTo(-4.2, 0.9);
  ctx.lineTo(4.4, 0.9);
  ctx.moveTo(-4.2, 2.7);
  ctx.lineTo(0.6, 2.7);
  strokeA(ctx, WHITE, 0.8, 0.8);
  ctx.beginPath();
  circ(ctx, 3.6, -1.3, 1.2);
  strokeA(ctx, WHITE, 0.8, 0.7);

  // fitilho
  ctx.beginPath();
  rr(ctx, -1, -4.9, 2, 9.8, 0.8);
  ctx.fillStyle = WARM_BAND;
  ctx.fill();
  strokeA(ctx, p.dark, 0.6, 0.5);
}

/** coins — moeda dourada girando (escala X varia com cos) */
function drawCoins(ctx: Ctx, p: Palette, time: number, phase: number): void {
  const c = Math.cos(time * 3.2 + phase);
  const scX = Math.max(0.16, c < 0 ? -c : c);
  ctx.scale(scX, 1);

  ctx.beginPath();
  circ(ctx, 0, 0, 6.4);
  paint(ctx, p.dark, 1, false);
  ctx.beginPath();
  circ(ctx, 0, 0, 5.2);
  ctx.fillStyle = p.base;
  ctx.fill();
  ctx.beginPath();
  circ(ctx, 0, 0, 3.9);
  strokeA(ctx, p.dark, 0.8, 0.45);
  ctx.beginPath();
  ctx.arc(0, 0, 4.8, 3.6, 4.6);
  strokeA(ctx, p.light, 1.1, 0.85);

  // símbolo só aparece quando a moeda está de frente (senão fica espremido)
  const sa = clamp((scX - 0.4) * 4, 0, 1);
  if (sa > 0) {
    ctx.font = COIN_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.dark;
    setA(ctx, sa);
    ctx.fillText('$', 0, 0.5);
    setA(ctx, 1);
  }

  ctx.scale(1 / scX, 1);
}

const SHAPES: Record<string, DropShape | undefined> = {
  wood: { draw: drawWood, bottom: 5.5 },
  planks: { draw: drawPlanks, bottom: 5.4 },
  stone: { draw: drawStone, bottom: 7.4 },
  ironOre: { draw: drawIronOrePile, bottom: 9 },
  ironIngot: { draw: drawIronIngot, bottom: 5.5 },
  gears: { draw: drawGears, bottom: 7.4 },
  steamCore: { draw: drawSteamCore, bottom: 7.6 },
  etherCryst: { draw: drawEtherCryst, bottom: 8.6 },
  relic: { draw: drawRelic, bottom: 7.4 },
  blueprints: { draw: drawBlueprints, bottom: 4.2 },
  coins: { draw: drawCoins, bottom: 6.4 },
};

export function drawResourceIcon(ctx: Ctx, resource: ResourceId): void {
  const shape = SHAPES[resource];
  if (!shape) return;

  const def = RESOURCES[resource];
  const palette = PALETTES[resource] ??= buildPalette(def.color, def.tier);
  ctx.save();
  curAlpha = ctx.globalAlpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  shape.draw(ctx, palette, 0, 0);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Estrelinha de brilho (4 pontas), fase própria por drop
// ─────────────────────────────────────────────────────────────────────────────

function drawSparkles(ctx: Ctx, tier: number, time: number, ph: number, seedI: number): void {
  const T = tier >= 3 ? 1.7 : tier === 2 ? 2.4 : 3.4; // tier 1: raro e discreto
  const size = tier >= 3 ? 6.2 : tier === 2 ? 5 : 3.8;
  const n = tier >= 3 ? 2 : 1;

  for (let j = 0; j < n; j++) {
    const u = (time + ph * T + j * T * 0.5) / T;
    const cyc = Math.floor(u);
    const t = u - cyc;
    if (t >= SPARK_WINDOW) continue;

    const k = Math.sin((t / SPARK_WINDOW) * Math.PI);
    const idx = (cyc + seedI + j) % 3;
    const cx = SPARK_X[idx];
    const cy = SPARK_Y[idx];
    const r = size * k;

    ctx.beginPath();
    circ(ctx, cx, cy, r * 0.85);
    fillA(ctx, SPARK_GLOW, 0.35 * k);

    ctx.beginPath();
    ctx.moveTo(cx + STAR[0] * r, cy + STAR[1] * r);
    for (let i = 2; i < 16; i += 2) ctx.lineTo(cx + STAR[i] * r, cy + STAR[i + 1] * r);
    ctx.closePath();
    fillA(ctx, SPARK_FILL, 0.6 + 0.4 * k);
    strokeA(ctx, SPARK_EDGE, 0.6, k);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/** Fallback: o círculo antigo, para recursos sem desenho dedicado. */
function drawFallback(ctx: Ctx, color: string, x: number, y: number, z: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y - z, 7.5, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = EDGE_LIGHT;
  ctx.stroke();
  ctx.restore();
}

/** true se o drop (com sombra/halo) cai dentro do retângulo da câmera. */
export function isDropVisible(view: ViewRect, x: number, y: number, z: number): boolean {
  return (
    x > view.x0 - CULL_MARGIN &&
    x < view.x1 + CULL_MARGIN &&
    y + CULL_MARGIN > view.y0 &&
    y - z - CULL_MARGIN < view.y1
  );
}

/**
 * Desenha um drop de recurso.
 *
 * @param x,y   posição no chão (mundo)
 * @param z     altura no ar (px); 0 = no chão
 * @param age   segundos desde o spawn
 * @param time  relógio global em segundos (animações contínuas)
 * @param seed  inteiro estável por drop (veja nextDropSeed); define a fase das animações
 * @param vx    velocidade horizontal atual, usada só para inclinar o item no ar
 */
export function drawDropItem(
  ctx: Ctx,
  resource: string,
  x: number,
  y: number,
  z: number,
  age: number,
  time: number,
  seed: number,
  vx: number = 0,
): void {
  if (resource === 'ironOre') {
    drawIronOreDrop(ctx, x, y, Math.max(0, z), age, time, seed);
    return;
  }

  const shape = SHAPES[resource];
  const def = RES[resource];
  if (shape === undefined) {
    drawFallback(ctx, def !== undefined ? def.color : '#cccccc', x, y, z);
    return;
  }

  let pal = PALETTES[resource];
  if (pal === undefined) {
    pal = buildPalette(def !== undefined ? def.color : '#b0b0b0', def !== undefined && def.tier !== undefined ? def.tier : 1);
    PALETTES[resource] = pal;
  }

  curAlpha = ctx.globalAlpha;
  const seedI = seed >>> 0;
  const slot = seedI & 1023;
  const ph = slot * INV_1024; // 0..1
  const phase = ph * TAU; // 0..2π
  const zz = z > 0 ? z : 0;

  // ── pulinho ao tocar o chão (~0.15s) ──
  let hop = 0;
  let landAmt = 0;
  if (zz > 0.05) {
    LAND_AT[slot] = -1;
  } else {
    if (LAND_AT[slot] < 0) LAND_AT[slot] = age;
    const dt = age - LAND_AT[slot];
    if (dt >= 0 && dt < LAND_TIME && age < 1.5) {
      const u = dt / LAND_TIME;
      landAmt = (1 - u) * Math.cos(u * TAU * 1.1); // achata, estica, assenta
      hop = Math.sin(u * Math.PI) * LAND_HOP;
    }
  }

  // ── no ar vs. no chão ──
  const air = zz > 0.05 ? (zz < 4 ? zz * 0.25 : 1) : 0; // 0..1
  const ground = 1 - (zz < 6 ? zz / 6 : 1); // 1 no chão, some ao subir
  const bob = (0.5 + 0.5 * Math.sin(time * BOB_SPEED + phase)) * BOB_AMP * ground;
  const h = zz + bob + hop;

  let tilt = clamp(vx * TILT_PER_VX, -TILT_MAX, TILT_MAX);
  tilt = tilt * air + Math.sin(time * 13 + phase) * 0.07 * air + Math.sin(time * 1.7 + phase) * 0.04 * ground;
  const sx = 1 - 0.06 * air + LAND_SQUASH * landAmt;
  const sy = 1 + 0.1 * air - LAND_SQUASH * landAmt;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ── sombra: encolhe e esmaece com a altura ──
  const f = clamp(h * 0.0625, 0, 1);
  const srx = SHADOW_RX * (1 - 0.45 * f) * (1 + 0.12 * landAmt);
  ctx.globalAlpha = curAlpha * SHADOW_ALPHA * (1 - 0.65 * f);
  ctx.fillStyle = SHADOW_COLOR;
  ctx.beginPath();
  ctx.ellipse(x, y + CONTACT + 1.4, srx, srx * 0.36, 0, 0, TAU);
  ctx.fill();

  // ── sprite: pivô na base (squash & stretch "grudado" no chão) ──
  ctx.translate(x, y + CONTACT - h);
  ctx.scale(sx, sy);
  ctx.translate(0, -shape.bottom);
  ctx.rotate(tilt);
  setA(ctx, 1);

  // halo suave para tier alto
  if (pal.tier >= 3) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 + phase);
    ctx.beginPath();
    circ(ctx, 0, 0, 12 + pulse * 1.5);
    fillA(ctx, pal.light, 0.1);
    ctx.beginPath();
    circ(ctx, 0, 0, 8.5);
    fillA(ctx, pal.light, 0.13 + 0.05 * pulse);
  }

  shape.draw(ctx, pal, time, phase);
  drawSparkles(ctx, pal.tier, time, ph, seedI);

  ctx.restore();
}
