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
import { DEFAULT_PLAYER_OUTFITS, type PlayerAppearance, type PlayerOutfit } from '../domain/PlayerAppearance.ts';
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
  toolLevel?: number;
  appearance?: PlayerAppearance;
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
const STRAW: Tone = { base: "#c98d48", light: "#e8b574", dark: "#9c6730", line: "#69401a" };
const BAND: Tone = { base: "#9b4938", light: "#cf795a", dark: "#723a2d", line: "#552c25" };
const CAP: Tone = { base: "#9a5139", light: "#c97a51", dark: "#753c2d", line: "#502f24" };
const LINEN: Tone = { base: "#e9d5ae", light: "#f8e8c9", dark: "#bd9e73", line: "#796043" };
const LINEN_SHADE: Tone = { base: "#cbb48f", light: "#e4cca5", dark: "#9e845e", line: "#755d43" };
const GLOVE: Tone = { base: "#8e5c31", light: "#b4824f", dark: "#5e3b1b", line: "#3b2210" };
const GLOVE_F: Tone = { base: "#74491f", light: "#966a3c", dark: "#4a2d12", line: "#2f1a0a" };
const BELT: Tone = { base: "#52321a", light: "#74492a", dark: "#35200f", line: "#22130a" };
const GOLD: Tone = { base: "#f5d058", light: "#fff3ae", dark: "#c99b23", line: "#80600f" };
const POUCH: Tone = { base: "#c27a3c", light: "#e39a5c", dark: "#8d5324", line: "#55300f" };
const ROLL: Tone = { base: "#ebdfba", light: "#fff8dc", dark: "#c4b488", line: "#8a7a50" };
const TEAL: Tone = { base: "#3f9f99", light: "#6fcbc4", dark: "#2a736f", line: "#16413e" };
const TIN: Tone = { base: "#c5cfd9", light: "#f6fafd", dark: "#8896a6", line: "#566577" };
const WOOD: Tone = { base: "#b57d44", light: "#d9a064", dark: "#7c4f27", line: "#4e2e14" };
const OILED_WOOD: Tone = { base: "#935d34", light: "#c58d55", dark: "#653d26", line: "#412619" };
const TOOL_IRON: Tone = { base: "#827c70", light: "#b6ab98", dark: "#5a554b", line: "#3e3931" };
const TOOL_STEEL: Tone = { base: "#a19d90", light: "#d9d0ba", dark: "#716b60", line: "#494238" };
const POLISHED_STEEL: Tone = { base: "#bbb6a6", light: "#f2e6cd", dark: "#817968", line: "#4a4136" };
const TOOL_BRASS: Tone = { base: "#b8884d", light: "#e5be7e", dark: "#805832", line: "#513923" };

const TOOL_HEADS = [TOOL_IRON, TOOL_IRON, TOOL_STEEL, TOOL_STEEL, POLISHED_STEEL, POLISHED_STEEL] as const;

const HAIR_TONES: Record<PlayerOutfit['hair'], Tone> = {
  swept: { base: "#6e4932", light: "#a5774c", dark: "#493024", line: "#35251e" },
  braid: { base: "#a45d3c", light: "#d3905c", dark: "#733e2b", line: "#4c2a22" }
};
const TOP_TONES: Record<PlayerOutfit['top'], { fabric: Tone; sleeve: Tone; farSleeve: Tone }> = {
  fieldVest: {
    fabric: { base: "#6f7751", light: "#a0a575", dark: "#52583c", line: "#363d2d" },
    sleeve: LINEN,
    farSleeve: LINEN_SHADE
  },
  trailJacket: {
    fabric: { base: "#845363", light: "#b48188", dark: "#633a49", line: "#492e36" },
    sleeve: { base: "#946576", light: "#bc929a", dark: "#6a4150", line: "#4f333e" },
    farSleeve: { base: "#714957", light: "#966f79", dark: "#563740", line: "#40303a" }
  }
};
const BOTTOM_TONES: Record<PlayerOutfit['bottoms'], { near: Tone; far: Tone }> = {
  charcoal: {
    near: { base: "#615a4f", light: "#8b7c67", dark: "#49433b", line: "#37332d" },
    far: { base: "#4f483f", light: "#746352", dark: "#3b342c", line: "#302b26" }
  },
  moss: {
    near: { base: "#777d60", light: "#a7a789", dark: "#595f48", line: "#404637" },
    far: { base: "#5e654e", light: "#8b8d71", dark: "#484f3d", line: "#373d33" }
  }
};
const BOOT_TONES: Record<PlayerOutfit['boots'], { near: Tone; far: Tone }> = {
  leather: {
    near: { base: "#70472f", light: "#9b6c48", dark: "#4e3226", line: "#35261f" },
    far: { base: "#593829", light: "#81543d", dark: "#41291e", line: "#31251e" }
  },
  suede: {
    near: { base: "#946340", light: "#c59462", dark: "#6c462f", line: "#4d3428" },
    far: { base: "#795337", light: "#a47650", dark: "#563826", line: "#3e2b22" }
  }
};
const PACK_TONES: Record<PlayerOutfit['backpack'], { body: Tone; trim: Tone }> = {
  amber: {
    body: { base: "#b67842", light: "#d9a062", dark: "#895633", line: "#593a2a" },
    trim: { base: "#9c603e", light: "#c38656", dark: "#73452f", line: "#55372a" }
  },
  plum: {
    body: { base: "#9b6970", light: "#c48e87", dark: "#704b51", line: "#4e353b" },
    trim: { base: "#754b52", light: "#a27570", dark: "#583841", line: "#452e35" }
  }
};
const SAGE_SCARF: Tone = { base: "#859764", light: "#b4bd89", dark: "#5a6a48", line: "#445039" };
const NECKWEAR_TONES = { rustScarf: BAND, sageScarf: SAGE_SCARF, none: null };

let outfit: Readonly<PlayerOutfit> = DEFAULT_PLAYER_OUTFITS.male;
let hair = HAIR_TONES.swept;
let top = TOP_TONES.fieldVest;
let bottoms = BOTTOM_TONES.charcoal;
let boots = BOOT_TONES.leather;
let pack = PACK_TONES.amber;
let scarf: Tone | null = BAND;
let faceWidth = 1;

function setAppearance(appearance?: PlayerAppearance): void {
  const preset = DEFAULT_PLAYER_OUTFITS[appearance?.variant ?? 'male'];
  outfit = appearance ? {
    hair: appearance.hair ?? preset.hair,
    headwear: appearance.headwear ?? preset.headwear,
    top: appearance.top ?? preset.top,
    bottoms: appearance.bottoms ?? preset.bottoms,
    boots: appearance.boots ?? preset.boots,
    backpack: appearance.backpack ?? preset.backpack,
    neckwear: appearance.neckwear ?? preset.neckwear,
    accessory: appearance.accessory ?? preset.accessory
  } : preset;
  hair = HAIR_TONES[outfit.hair];
  top = TOP_TONES[outfit.top];
  bottoms = BOTTOM_TONES[outfit.bottoms];
  boots = BOOT_TONES[outfit.boots];
  pack = PACK_TONES[outfit.backpack];
  scarf = NECKWEAR_TONES[outfit.neckwear];
  faceWidth = appearance?.variant === 'female' ? .94 : 1;
}

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
  th: 0, // ângulo do braço da ferramenta (rad, já espelhado se preciso)
  ga: 0, // ângulo do cabo (rad)
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
  if (activeTool === 'pickaxe') {
    // A cabeça larga fica afastada do rosto, voltando ao alinhamento no golpe.
    const resting = (1 - bs) / (1 - bsR);
    ga += (kf === KF_SIDE ? 24 : -27) * resting;
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

// ============================================================================
// Ferramenta, braços e luvas
// ============================================================================
let activeTool: PlayerPose['tool'];
let toolLevel = 0;

function toolHeadScale(): number {
  return (.91 + toolLevel * .042) * (.78 + .22 * A.bs);
}

function axeHeadPath(c: Ctx): void {
  const beard = toolLevel >= 3 ? -6.8 : -9;
  c.beginPath();
  c.moveTo(-4.3, -17.8);
  c.quadraticCurveTo(-1, -19.3, 3.6, -17.9);
  c.lineTo(11, -22.3);
  c.quadraticCurveTo(16.5, -15.7, 11.5, beard);
  c.quadraticCurveTo(8.8, beard + .65, 3.6, -12.5);
  c.lineTo(-4.3, -12.5);
  c.closePath();
}

function pickaxeHeadPath(c: Ctx): void {
  c.beginPath();
  c.moveTo(-13.1, -9.6);
  c.bezierCurveTo(-10.6, -15.8, -5.1, -20.6, 0, -19.8);
  c.bezierCurveTo(5.4, -20.5, 11.6, -16.5, 14, -8.8);
  c.quadraticCurveTo(6.5, -14.9, 2.2, -14.7);
  c.quadraticCurveTo(0, -13.4, -2.5, -14.7);
  c.quadraticCurveTo(-7.2, -14.3, -13.1, -9.6);
  c.closePath();
}

function drawTool(c: Ctx, hx: number, hy: number, fm: number): void {
  c.save();
  c.translate(hx, hy);
  c.scale(fm, 1);
  c.rotate(fm * (A.ga + Math.PI / 2));
  tube(c, -.5, 10.8, 0, -15.6, 2, toolLevel >= 2 ? OILED_WOOD : WOOD);
  if (toolLevel >= 1) {
    paintRRect(c, BELT, -2, 3, 3.25, 7.4, 1, .65);
    c.strokeStyle = GLOVE.light;
    c.lineWidth = .65;
    c.beginPath();
    for (let y = 4.7; y < 10; y += 1.8) {
      c.moveTo(-1.5, y);
      c.lineTo(.8, y - .6);
    }
    c.stroke();
  }

  const metal = TOOL_HEADS[toolLevel];
  const pickaxe = activeTool === 'pickaxe';
  c.save();
  c.scale(toolHeadScale(), 1);
  paintPath(c, pickaxe ? pickaxeHeadPath : axeHeadPath, metal, -12, -23, 27, 16, 1);

  c.beginPath();
  if (pickaxe) {
    c.moveTo(-11.8, -11.1);
    c.quadraticCurveTo(-9.7, -15, -5.3, -16.8);
    c.moveTo(5.2, -17.2);
    c.quadraticCurveTo(10.7, -15.7, 12.7, -10.7);
  } else {
    const beard = toolLevel >= 3 ? -6.8 : -9;
    c.moveTo(10.6, -20.8);
    c.quadraticCurveTo(14.4, -15.1, 10.9, beard - 1.3);
  }
  c.strokeStyle = metal.light;
  c.lineWidth = toolLevel >= 3 ? 1.7 : 1.05;
  c.stroke();

  if (toolLevel === TOOL_HEADS.length - 1) {
    c.beginPath();
    const x = pickaxe ? 4.9 : 7;
    c.moveTo(x, -17.6);
    c.lineTo(x + 1.5, -15.9);
    c.lineTo(x, -14.2);
    c.lineTo(x - 1.5, -15.9);
    c.closePath();
    c.strokeStyle = TOOL_BRASS.light;
    c.lineWidth = .75;
    c.stroke();
  }
  c.restore();

  const collar = toolLevel >= 4 ? TOOL_BRASS : toolLevel >= 2 ? TOOL_STEEL : TOOL_IRON;
  const collarHeight = toolLevel >= 2 ? 5.8 : 3.6;
  paintRRect(c, collar, -2, -15.4, 4, collarHeight, .8, .75);
  if (toolLevel >= 2) {
    c.fillStyle = collar.light;
    c.fillRect(-.55, -13.5, 1.1, 1.1);
    if (toolLevel >= 4) c.fillRect(-.55, -11.5, 1.1, 1.1);
  }
  c.restore();
}

function armTubes(c: Ctx, sx: number, sy: number, hx: number, hy: number, far: boolean): void {
  const sl = far ? top.farSleeve : top.sleeve;
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

/** Converte um ponto da ferramenta para o referencial do desenho. */
function toolPt(lx: number, ly: number, fm: number): void {
  const psi = fm * (A.ga + Math.PI / 2);
  const cs = Math.cos(psi);
  const sn = Math.sin(psi);
  PX = (lx * cs - ly * sn) * fm;
  PY = lx * sn + ly * cs;
}

/** Rastro da ponta da ferramenta durante a fase rápida do golpe. */
function drawTrail(c: Ctx, kf: readonly number[], sx: number, sy: number, mir: boolean, fm: number): void {
  const s = A.sw;
  const b = s < 0.5 ? s : 0.5;
  const a = Math.max(0.28, b - 0.2);
  const fade = s < 0.5 ? 1 : 1 - (s - 0.5) / 0.14;
  if (fade <= 0 || b - a < 0.01) return;
  const pickaxe = activeTool === 'pickaxe';
  for (let i = 0; i <= TRAIL_N; i++) {
    solveSwing(kf, a + ((b - a) * i) / TRAIL_N, mir);
    const hx = sx + ARM_L * Math.cos(A.th);
    const hy = sy + ARM_L * Math.sin(A.th);
    const headScale = toolHeadScale();
    toolPt((pickaxe ? 14 : 13.7) * headScale, pickaxe ? -8.8 : -15.4, fm);
    trTx[i] = hx + PX;
    trTy[i] = hy + PY;
    toolPt(7.2 * headScale, -15.3, fm);
    trMx[i] = hx + PX;
    trMy[i] = hy + PY;
  }
  solveSwing(kf, s, mir); // restaura o estado atual

  c.save();
  const opacity = c.globalAlpha;
  c.globalAlpha = opacity * .22 * fade;
  c.fillStyle = "#fff0d5";
  c.beginPath();
  c.moveTo(trTx[0], trTy[0]);
  for (let i = 1; i <= TRAIL_N; i++) c.lineTo(trTx[i], trTy[i]);
  for (let i = TRAIL_N; i >= 0; i--) c.lineTo(trMx[i], trMy[i]);
  c.closePath();
  c.fill();
  c.globalAlpha = opacity * .58 * fade;
  c.strokeStyle = "#fff0d5";
  c.lineWidth = 1.1;
  c.beginPath();
  c.moveTo(trTx[0], trTy[0]);
  for (let i = 1; i <= TRAIL_N; i++) c.lineTo(trTx[i], trTy[i]);
  c.stroke();
  c.restore();
}

/** Braço que segura a ferramenta, com o rastro do golpe. */
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
  c.save();
  c.scale(faceWidth, 1);
  paintEllipse(c, hair, 0, -28.5, 7.2, 6.2); // cabelo atrás
  paintEllipse(c, SKIN, -6.5, -25.6, 1.4, 1.8, 0.8); // orelhas
  paintEllipse(c, SKIN, 6.5, -25.6, 1.4, 1.8, 0.8);
  paintEllipse(c, SKIN, 0, -26.4, 6.3, 5.9); // rosto
  paintPath(c, fringePath, hair, -6.7, -34, 13.5, 7, .7);
  // sobrancelhas
  c.strokeStyle = hair.dark;
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
  // Bochechas e sardas.
  c.fillStyle = "rgba(213,111,91,0.35)";
  c.beginPath();
  c.ellipse(-3.9, -22.9, 1.25, 0.8, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(3.9, -22.9, 1.25, 0.8, 0, 0, TAU);
  c.fill();
  c.fillStyle = "rgba(143,75,52,0.65)";
  for (const side of [-1, 1]) {
    c.fillRect(side * 2.5 - .3, -23.6, .6, .55);
    c.fillRect(side * 3.6 - .3, -23.25, .6, .55);
    c.fillRect(side * 4.55 - .3, -23.55, .6, .55);
  }
  mouth(c, 0, -21.7, 2.6);
  c.restore();
}

function headBack(c: Ctx): void {
  paintEllipse(c, SKIN, -6.8, -25.6, 1.3, 1.7, 0.8); // orelhas espiando
  paintEllipse(c, SKIN, 6.8, -25.6, 1.3, 1.7, 0.8);
  paintEllipse(c, hair, 0, -27.3, 7.3, 6.8); // cabelo por trás
  // mecha da nuca balançando
  paintEllipse(c, hair, A.hair * 0.4, -21.6, 5.2, 1.9, 0.8);
  c.strokeStyle = hair.light;
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(-4.7, -27.5);
  c.quadraticCurveTo(-2.6, -29, -.8, -23.7);
  c.moveTo(-2.3, -28.3);
  c.quadraticCurveTo(2.2, -30.2, 4.2, -24.4);
  c.stroke();
}

function headSide(c: Ctx): void {
  c.save();
  c.scale(faceWidth, 1);
  paintEllipse(c, SKIN, 1.2, -26.3, 5.9, 5.8); // rosto
  paintEllipse(c, SKIN, 6.7, -25.0, 1.5, 1.3, 0.8); // nariz de perfil
  paintEllipse(c, hair, -3.6, -27.6, 5.0, 6.5); // cabelo (nuca/topo)
  c.save();
  c.translate(.6, -.2);
  paintPath(c, fringePath, hair, -6.7, -34, 13.5, 7, .7);
  c.restore();
  paintEllipse(c, hair, 1.0 + A.hair * 0.25, -25.2, 1.1, 2.3, 0.7); // costeleta
  paintEllipse(c, SKIN, -1.2, -25.0, 1.5, 1.9, 0.8); // orelha
  c.fillStyle = SKIN.dark;
  c.beginPath();
  c.ellipse(-1.15, -24.9, 0.6, 0.95, 0, 0, TAU);
  c.fill();
  // sobrancelha, olho, bochecha, boca
  c.strokeStyle = hair.dark;
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
  c.restore();
}

function fringePath(c: Ctx): void {
  c.beginPath();
  c.moveTo(-6.8, -27.7);
  c.bezierCurveTo(-8, -31.3, -5.3, -34.5, -1.5, -34.7);
  c.bezierCurveTo(3.7, -35, 6.3, -31.7, 6.3, -28.6);
  c.quadraticCurveTo(3.1, -28.9, 1.3, -30.7);
  c.quadraticCurveTo(-1, -27.8, -4.6, -28.2);
  c.lineTo(-6.8, -27.7);
  c.closePath();
}

function drawBraid(c: Ctx, facing: 'front' | 'back' | 'side'): void {
  if (outfit.hair !== 'braid') return;

  const x = facing === 'front' ? 5.6 : facing === 'back' ? -3.5 : -6.5;
  const bend = facing === 'front' ? 1 : -1;
  c.save();
  c.translate(x, -26.5);
  c.rotate(bend * -.16 + A.hair * .23 - A.ox * .04);
  for (let i = 0; i < 5; i++) {
    const offset = i % 2 === 0 ? -.65 : .65;
    paintEllipse(c, hair, offset, 1.9 + i * 2.3, 2.3 - i * .22, 1.9 - i * .12, .7);
  }
  paintEllipse(c, hair, bend * .35, 12.8, 1.2, 1.65, .65);
  paintRRect(c, scarf ?? CAP, -1.25, 10.8, 2.5, 1.35, .45, .6);
  c.restore();
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
function drawHeadwear(c: Ctx, face: number): void {
  if (outfit.headwear === 'none') return;
  if (outfit.headwear === 'trailCap') {
    drawTrailCap(c, face);
    return;
  }
  const hx = face === 2 ? 0.6 : 0;
  c.save();
  c.translate(hx, 0);
  // aba larga
  paintEllipse(c, STRAW, 0, -33.4, 14.2, 4.3, 1.0);
  // trama de palha na aba: raios + anel
  c.strokeStyle = "#a96f2e";
  c.lineWidth = 0.45;
  c.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = (i * TAU) / 18;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    c.moveTo(ca * 7.6, -33.2 + sa * 2.5);
    c.lineTo(ca * 13.2, -33.4 + sa * 3.8);
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
    paintRRect(c, TOOL_BRASS, -1.8, -35.9, 3.6, 3, .8, .65);
    c.fillStyle = TOOL_BRASS.line;
    c.fillRect(-.45, -35.2, .9, 1.5);
  }
  c.restore();
}

function capPath(c: Ctx): void {
  c.beginPath();
  c.moveTo(-9.4, -33);
  c.bezierCurveTo(-10.1, -36.7, -6.9, -41.1, -.25, -41.3);
  c.bezierCurveTo(5.1, -41.5, 9.8, -38.7, 9.4, -34);
  c.quadraticCurveTo(0, -30.9, -9.4, -33);
  c.closePath();
}

function drawTrailCap(c: Ctx, face: number): void {
  paintPath(c, capPath, CAP, -10, -41.5, 20, 10);
  c.strokeStyle = CAP.light;
  c.lineWidth = .75;
  c.beginPath();
  c.moveTo(-6.5, -35.2);
  c.quadraticCurveTo(-5.4, -39.2, -.3, -40.5);
  c.moveTo(4.9, -35.5);
  c.quadraticCurveTo(3.8, -39.1, -.3, -40.5);
  c.stroke();
  paintEllipse(c, CAP, -.3, -41, 1.4, .75, .55);

  if (face === 1) {
    paintRRect(c, TOOL_BRASS, -1.9, -33.6, 3.8, 1.8, .6, .6);
  } else {
    const visorX = face === 2 ? 6.6 : 0;
    c.save();
    c.translate(visorX, -33.3);
    c.rotate(face === 2 ? .14 : 0);
    paintEllipse(c, OILED_WOOD, 0, 0, face === 2 ? 7 : 8.6, 1.8, .75);
    c.restore();
  }
}

function drawNeckwear(c: Ctx, side: boolean): void {
  if (!scarf) return;
  const x = side ? .25 : 0;
  paintRRect(c, scarf, x - 4.9, -22.4, 9.8, 3.4, 1.35, .7);
  c.save();
  c.translate(x - 3, -20.1);
  c.rotate(-.31 + A.rib2 * .35);
  paintRRect(c, scarf, -.8, -.5, 2.2, 4.5, .6, .65);
  paintEllipse(c, scarf, .5, 0, 1.3, 1.05, .65);
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
  tube(c, side * 2.9 + A.ox, -9.4 + A.oy, fx, fy - 4.4, 4.8, bottoms.near);
  paintRRect(c, boots.near, fx - 3.2, fy - 5.0, 6.4, 5.2, 2.2);
  c.fillStyle = boots.near.dark;
  c.fillRect(fx - 2.4, fy - 1, 4.8, 0.8);
  if (back) return;
  c.fillStyle = boots.near.light;
  c.fillRect(fx - 1.5, fy - 3.4, 2.8, .65);
}

function legSide(c: Ctx, ph: number, far: boolean): void {
  const s = Math.sin(ph);
  const fx = A.moving ? s * 4.4 : far ? -1.2 : 1.2;
  const lift = A.moving ? Math.max(0, Math.cos(ph)) * 2.6 : 0;
  tube(c, 0.2 + A.ox, -9.4 + A.oy, fx, -4.6 - lift, 4.8, far ? bottoms.far : bottoms.near);
  const bt = far ? boots.far : boots.near;
  paintRRect(c, bt, fx - 3.2, -4.9 - lift, 8.2, 5.0, 2.2);
  c.strokeStyle = bt.line;
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(fx - 2.4, -1.0 - lift);
  c.lineTo(fx + 4.2, -1.0 - lift);
  c.stroke();
  c.fillStyle = bt.light;
  c.fillRect(fx + .3, -3.3 - lift, 2.4, .55);
}

// ============================================================================
// VISTA DE FRENTE ("down")
// ============================================================================
let packFill = 0;
let packOpen = 0;
const visibleCargo: ResourceId[] = [];

function drawPackAccessory(c: Ctx, x: number, y: number, side: boolean): void {
  if (outfit.accessory === 'none') return;

  c.save();
  c.translate(x, y);
  c.rotate(A.mug);
  c.strokeStyle = pack.body.line;
  c.lineWidth = .75;
  c.beginPath();
  c.moveTo(0, -.5);
  c.lineTo(0, 2.2);
  c.stroke();

  if (outfit.accessory === 'brassCompass') {
    paintEllipse(c, TOOL_BRASS, 0, 4.2, 2.85, 2.85, .7);
    paintEllipse(c, LINEN, 0, 4.2, 1.95, 1.95, .45);
    c.beginPath();
    c.moveTo(.85, 2.85);
    c.lineTo(.35, 4.75);
    c.lineTo(-.95, 5.4);
    c.lineTo(-.4, 3.8);
    c.closePath();
    c.fillStyle = BAND.dark;
    c.fill();
  } else {
    const handle = side ? -1 : 1;
    c.strokeStyle = TIN.line;
    c.beginPath();
    c.moveTo(handle * 1.6, 2.55);
    c.quadraticCurveTo(handle * 4.6, 3.3, handle * 1.6, 5.25);
    c.stroke();
    paintRRect(c, TIN, -1.95, 1.65, 3.9, 4.2, .85, .7);
    c.fillStyle = TIN.light;
    c.fillRect(-1.4, 2, 2.8, .7);
  }
  c.restore();
}

function packCompartment(c: Ctx, x: number, y: number, width: number, height: number): void {
  paintRRect(c, pack.body, x, y, width, height, 4.2);
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
    c.fillStyle = pack.body.light;
    c.fillRect(innerX + 1, innerY + opening - 0.65, innerWidth - 2, 0.65);
  }

  const flapHeight = 6.4 - 3.5 * packOpen;
  const flapY = y - 2.4 * packOpen;
  paintRRect(c, pack.trim, x, flapY, width, flapHeight, Math.min(3, flapHeight / 2));
  c.strokeStyle = pack.trim.light;
  c.lineWidth = .55;
  c.beginPath();
  c.moveTo(x + 2, flapY + 1.45);
  c.lineTo(x + width - 2, flapY + 1.45);
  c.stroke();
}

function packFront(c: Ctx): void {
  const sw = A.moving ? Math.sin(A.p) * 0.4 : 0;
  c.save();
  c.translate(sw, 0);
  // Vista de frente: a lateral da bolsa aparece atrás do ombro livre.
  packCompartment(c, -8.8 + packFill * 5, -24.3, 17.6 + packFill * 2.6, 12.3 + packFill * 2);
  paintRRect(c, ROLL, -9.8, -12.8, 19.6, 4.8, 2.4);
  c.fillStyle = pack.body.dark;
  c.fillRect(-6.8, -12.8, 1.6, 4.8);
  c.fillRect(5.2, -12.8, 1.6, 4.8);
  c.restore();
}

function torsoFront(c: Ctx): void {
  paintRRect(c, LINEN, -7.2, -21.6, 14.4, 12.4, 3.6);
  if (outfit.top === 'fieldVest') {
    K = 1;
    paintPath(c, vestPath, top.fabric, 1.5, -21.4, 5.7, 11.6);
    K = -1;
    paintPath(c, vestPath, top.fabric, -7.2, -21.4, 5.7, 11.6);
    paintRRect(c, top.fabric, 2.7, -16.1, 3.7, 3.6, .7, .6);
  } else {
    paintRRect(c, top.fabric, -7.1, -21.2, 14.2, 11.7, 3.1);
    c.strokeStyle = top.fabric.line;
    c.lineWidth = .8;
    c.beginPath();
    c.moveTo(.25, -20.7);
    c.lineTo(.25, -11.8);
    c.moveTo(3, -14.4);
    c.lineTo(5.9, -15.7);
    c.stroke();
  }
  c.fillStyle = TOOL_BRASS.light;
  for (let y = -17.3; y < -12.5; y += 1.9) c.fillRect(-.45, y, .9, .8);

  paintRRect(c, BELT, -7.4, -11.7, 14.8, 2.6, 1.0);
  paintRRect(c, TOOL_BRASS, -1.6, -12.0, 3.2, 3.2, 0.8, 0.7);
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
  drawNeckwear(c, false);
  // braço livre (lado direito da tela)
  const fdy = A.moving ? 1.5 * Math.sin(A.p) : 0;
  armTubes(c, 7.0, -19.2, 8.4, -10.9 + fdy, false);
  glove(c, 8.4, -10.9 + fdy, false);
  headFront(c);
  drawBraid(c, 'front');
  drawHeadwear(c, 0);
  // Braço que segura a ferramenta.
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
  c.fillStyle = pack.body.line;
  const strapY = -20.6 + packOpen * 3.7;
  c.fillRect(-3.9, strapY, 1.9, 7.8 - packOpen * 3.7);
  c.fillRect(2.0, strapY, 1.9, 7.8 - packOpen * 3.7);
  paintRRect(c, TOOL_BRASS, -4.1, strapY + 1.8, 2.3, 1.9, 0.5, 0.6);
  paintRRect(c, TOOL_BRASS, 1.8, strapY + 1.8, 2.3, 1.9, 0.5, 0.6);
  // rolo de dormir na base da mochila
  paintRRect(c, ROLL, -9.6, -12.6, 19.2, 4.8, 2.4);
  c.fillStyle = TEAL.base;
  c.fillRect(-7.6, -10.9, 15.2, 1.3);
  c.fillStyle = pack.body.dark;
  c.fillRect(-6.2, -12.6, 1.7, 4.8);
  c.fillRect(4.5, -12.6, 1.7, 4.8);
  drawPackAccessory(c, -8 - bulk / 2, -18.8, false);
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
  drawNeckwear(c, false);
  headBack(c);
  packBack(c);
  drawBraid(c, 'back');
  drawHeadwear(c, 1);
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
  drawPackAccessory(c, -14.4 - 5 * packFill, -18, true);
  // corpo da mochila
  packCompartment(c, -13 - 5 * packFill, -25.6, 9.6 + 5 * packFill, 14 + 2.4 * packFill);
  paintRRect(c, pack.trim, -11.6, -17.4, 6.4, 4.6, 1.6, 0.8); // bolso lateral
  c.fillStyle = pack.body.line;
  c.fillRect(-9.2, -19.4, 1.7, 4.0);
  paintRRect(c, TOOL_BRASS, -9.4, -17.4, 2.1, 1.7, 0.5, 0.6);
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
  paintRRect(c, LINEN, -4.8, -21.6, 9.6, 12.4, 3.4);
  paintRRect(c, top.fabric, -4.9, -21.4, 8.4, 11.6, 3.2);
  // alça da mochila sobre o ombro
  tube(c, -3.0, -22.2, 0.8, -21.6, 2.0, pack.trim);
  tube(c, 0.8, -21.6, 1.6, -16.2, 2.0, pack.trim);
  paintRRect(c, TOOL_BRASS, .4, -19.2, 2.4, 1.8, .45, .55);
  // cinto, fivela, bolsinho
  paintRRect(c, BELT, -5.0, -11.7, 10.0, 2.6, 1.0);
  paintRRect(c, TOOL_BRASS, 3.2, -12.0, 2.2, 3.2, 0.6, 0.7);
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
  drawNeckwear(c, true);
  headSide(c);
  drawBraid(c, 'side');
  drawHeadwear(c, 2);
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
  setAppearance(pose.appearance);
  activeTool = pose.tool;
  toolLevel = Math.min(TOOL_HEADS.length - 1, Math.max(0, Math.floor(pose.toolLevel || 0)));
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
