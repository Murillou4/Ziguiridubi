/**
 * world-terrain.ts
 * ----------------------------------------------------------------------------
 * Terreno "vivo", iluminação sincronizada ao ciclo do dia e fauna por ilha.
 *
 * - Hora local real (`localHourDecimal`) define quais espécies estão ativas e
 *   calcula a entrada/saída gradual (inclusive na virada da meia-noite).
 * - Relógio da simulação (`dt` e `worldTime`) conduz ciclos de repouso,
 *   caminhada/saltitos, voo batido e voo planado de cada animal.
 */

import { IslandDef, ResourceNode } from '../domain/types.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';
import {
  FAUNA_SPECIES_DEF,
  FaunaSpeciesDef,
  HUB_PLAZA,
  ISLAND_FAUNA_CONFIG,
  TimeWindow
} from '../config/world.ts';
import type { IslandLighting } from '../core/GameClock.ts';
import { CLEAR_WEATHER, type WeatherSnapshot } from '../core/RainCycle.ts';

export interface ViewRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FocusPoint {
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

// ============================================================================
// Paletas por ilha
// ============================================================================
interface Palette {
  readonly blades: readonly string[];
  readonly flowers: readonly string[];
  readonly petals: readonly string[];
  readonly stem: string;
  readonly leaf: string;
  readonly glow: string;
  readonly vine: string;
}

const PAL_HUB: Palette = {
  blades: ['#3f7d45', '#6fb35c', '#a2de78'],
  flowers: ['#ff9fb8', '#fff3d6', '#ffd35c', '#c8a6ff', '#ff9a6b', '#8fd3ff'],
  petals: ['#ffc2d4', '#fff0d2', '#ffe08a', '#bfe39a'],
  stem: '#3f7d45',
  leaf: '#5aa34e',
  glow: '#f3ffa8',
  vine: '#3f7a46'
};

const PAL_EAST: Palette = {
  blades: ['#59723d', '#8aa65a', '#c0d37c'],
  flowers: ['#ffd35c', '#ffb25c', '#fff3d6', '#ff8a7a', '#e9c46a'],
  petals: ['#ffd9a0', '#fff0d2', '#f6b86b', '#cfe08a'],
  stem: '#566f3a',
  leaf: '#7d9a4c',
  glow: '#ffe9a0',
  vine: '#5a7a3e'
};

const PAL_NORTH: Palette = {
  blades: ['#426e58', '#80a882', '#bfc99b'],
  flowers: ['#c9d9ca', '#fff4d6', '#c3cde8', '#e4d29b', '#a7c9cf'],
  petals: ['#ffd0e2', '#ffffff', '#d9c6ff', '#c8f0c8'],
  stem: '#3f8264',
  leaf: '#5db083',
  glow: '#e8ffc0',
  vine: '#3f8a63'
};

const PAL_WEST: Palette = {
  blades: ['#2f7f8c', '#5ebdc4', '#9ee8ea'],
  flowers: ['#9fe8ff', '#c8b4ff', '#ffffff', '#ffb3e6', '#a5ffe0'],
  petals: ['#bfeeff', '#e0d0ff', '#ffffff', '#ffd0f0'],
  stem: '#2f7f8c',
  leaf: '#4fb0b8',
  glow: '#c8f4ff',
  vine: '#3a8d99'
};

const PALETTES: Record<string, Palette> = {
  hub: PAL_HUB,
  east_hill: PAL_EAST,
  north_dock: PAL_NORTH,
  west_crystal: PAL_WEST
};

const CAP_COLORS: readonly string[] = ['#e2574c', '#f08aa3', '#e89a4a', '#a98be0'];

type AccentKind = 'shrub' | 'reeds' | 'slate' | 'crystal';
type GrassKind = 'fan' | 'bent' | 'fine';

interface TerrainProfile {
  grassPatches: number;
  grassHeight: number;
  grassKinds: readonly GrassKind[];
  flowerPatches: number;
  flowerKinds: readonly number[];
  accents: number;
  accentKind: AccentKind;
}

const MEADOW: TerrainProfile = {
  grassPatches: 67, grassHeight: 17, grassKinds: ['fan', 'bent', 'fine'],
  flowerPatches: 33, flowerKinds: [0, 1, 2, 3], accents: 24, accentKind: 'shrub'
};

const TERRAIN_PROFILES: Record<string, TerrainProfile> = {
  hub: MEADOW,
  east_hill: {
    grassPatches: 26, grassHeight: 10, grassKinds: ['fine', 'bent'],
    flowerPatches: 8, flowerKinds: [0, 1], accents: 36, accentKind: 'slate'
  },
  north_dock: {
    grassPatches: 33, grassHeight: 16, grassKinds: ['bent', 'fine'],
    flowerPatches: 13, flowerKinds: [1, 3], accents: 30, accentKind: 'reeds'
  },
  west_crystal: {
    grassPatches: 0, grassHeight: 0, grassKinds: [],
    flowerPatches: 0, flowerKinds: [], accents: 44, accentKind: 'crystal'
  }
};

// ============================================================================
// Estruturas da decoração e da fauna dinâmica
// ============================================================================
interface Tuft { x: number; y: number; h: number; spread: number; ph: number; kind: GrassKind }
interface Flower { x: number; y: number; h: number; ph: number; kind: number; col: number; size: number }
interface Accent { x: number; y: number; size: number; kind: AccentKind; variant: number }
interface Mushroom { x: number; y: number; r: number; ph: number; cap: number }
interface Pebble { x: number; y: number; rx: number }
interface Glint { x: number; y: number; ph: number; r: number }
interface Patch { x: number; y: number; rx: number; ry: number }
interface Vine { x: number; len: number; ph: number; root: boolean; bud: boolean; moss: number }
interface Firefly { ax: number; ay: number; ph: number }
interface Petal { sx: number; sy: number; period: number; ph: number; col: number }
interface CloudShadow { ph: number; yFrac: number; rx: number; ry: number; speed: number }

export type FaunaBehavior = 'rest' | 'walk' | 'fly';

export interface FaunaAgent {
  species: FaunaSpeciesDef;
  windows: readonly TimeWindow[];
  fadeHours: number;
  staggerHours: number;
  color: string;
  phase: number;
  /** Presença visível atual [0..1] (transição suave na entrada e saída de cena). */
  alpha: number;
  /** Presença alvo calculada a partir da hora local real [0..1]. */
  targetAlpha: number;
  behavior: FaunaBehavior;
  stateTimer: number;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  heading: number;
  orbitAngle: number;
  orbitRadiusX: number;
  orbitRadiusY: number;
  orbitSpeed: number;
  homeX: number;
  homeY: number;
  rainBehavior: 'outside' | 'seeking' | 'sheltered';
  rainPatience: number;
  rainTimer: number;
  startledFor: number;
}

interface Decor {
  pal: Palette;
  patchesLight: Patch[];
  patchesDark: Patch[];
  tufts: Tuft[][];
  flowers: Flower[];
  accents: Accent[];
  mushrooms: Mushroom[];
  pebbles: Pebble[];
  glints: Glint[];
  vines: Vine[];
  fireflies: Firefly[];
  petals: Petal[];
  shadows: CloudShadow[];
  fauna: FaunaAgent[];
}

const cache = new Map<string, Decor>();

// ============================================================================
// Utilidades matemáticas e geométricas
// ============================================================================
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function frac(v: number): number {
  return v - Math.floor(v);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Calcula a presença alvo [0..1] de uma faixa horária em relação à hora local [0, 24).
 * Trata continuamente janelas que cruzam a meia-noite (ex.: 18.5 -> 5.5).
 */
export function evaluateWindowPresence(
  hourDecimal: number,
  win: TimeWindow,
  fadeHours: number,
  staggerHours: number
): number {
  const h = ((hourDecimal % 24) + 24) % 24;
  const rawSpan = ((win.endHour - win.startHour) % 24 + 24) % 24;
  const fullDuration = rawSpan === 0 ? 24 : rawSpan;
  const effectiveStagger = Math.min(staggerHours, fullDuration * 0.25);
  const effectiveDuration = Math.max(0.05, fullDuration - effectiveStagger * 2);
  const adjustedStart = (((win.startHour + effectiveStagger) % 24) + 24) % 24;

  const elapsed = ((h - adjustedStart) % 24 + 24) % 24;
  if (elapsed > effectiveDuration) return 0;

  const fade = Math.max(0.02, Math.min(fadeHours, effectiveDuration * 0.45));
  const fadeIn = clamp(elapsed / fade, 0, 1);
  const fadeOut = clamp((effectiveDuration - elapsed) / fade, 0, 1);
  const linear = Math.min(fadeIn, fadeOut);
  return linear * linear * (3 - 2 * linear);
}

export function evaluateSpeciesPresence(
  hourDecimal: number,
  windows: readonly TimeWindow[],
  fadeHours: number,
  staggerHours: number
): number {
  let best = 0;
  for (let i = 0; i < windows.length; i++) {
    const p = evaluateWindowPresence(hourDecimal, windows[i], fadeHours, staggerHours);
    if (p > best) best = p;
  }
  return best;
}

function islandPath(ctx: CanvasRenderingContext2D, isl: IslandDef): void {
  const x = isl.x - isl.w / 2;
  const y = isl.y - isl.h / 2;
  const r = 38;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + isl.w, y, x + isl.w, y + isl.h, r);
  ctx.arcTo(x + isl.w, y + isl.h, x, y + isl.h, r);
  ctx.arcTo(x, y + isl.h, x, y, r);
  ctx.arcTo(x, y, x + isl.w, y, r);
  ctx.closePath();
}

function islandVisible(isl: IslandDef, view: ViewRect | undefined, extra: number): boolean {
  if (!view) return true;
  return (
    isl.x + isl.w / 2 + extra >= view.x0 &&
    isl.x - isl.w / 2 - extra <= view.x1 &&
    isl.y + isl.h / 2 + extra >= view.y0 &&
    isl.y - isl.h / 2 - extra <= view.y1
  );
}

function inView(view: ViewRect | undefined, x: number, y: number, m: number): boolean {
  if (!view) return true;
  return x >= view.x0 - m && x <= view.x1 + m && y >= view.y0 - m && y <= view.y1 + m;
}

function bendFrom(x: number, y: number, focus: FocusPoint | undefined): number {
  if (!focus) return 0;
  const dx = x - focus.x;
  const dy = y - focus.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > 3364) return 0;
  const d = Math.sqrt(d2) || 1;
  return (dx / d) * (1 - d / 58) * 8;
}

// ============================================================================
// Zonas bloqueadas (praça e construções)
// ============================================================================
const BP_RECTS = BLUEPRINTS_DEF.map(bp => ({
  x0: bp.x,
  y0: bp.y,
  x1: bp.x + bp.w,
  y1: bp.y + bp.h + (bp.isBridge ? 0 : 28)
}));

function blocked(x: number, y: number, pad: number): boolean {
  const px = (x - HUB_PLAZA.x) / (HUB_PLAZA.radiusX + pad);
  const py = (y - HUB_PLAZA.y) / (HUB_PLAZA.radiusY + pad);
  if (px * px + py * py < 1) return true;

  for (let i = 0; i < BP_RECTS.length; i++) {
    const r = BP_RECTS[i];
    if (x > r.x0 - pad && x < r.x1 + pad && y > r.y0 - pad && y < r.y1 + pad) return true;
  }
  return false;
}

function pick(rng: () => number, isl: IslandDef, pad: number, margin: number): [number, number] | null {
  const hw = isl.w / 2 - margin;
  const hh = isl.h / 2 - margin;
  for (let i = 0; i < 16; i++) {
    const x = isl.x + (rng() * 2 - 1) * hw;
    const y = isl.y + (rng() * 2 - 1) * hh;
    if (!blocked(x, y, pad)) return [x, y];
  }
  return null;
}

function decorFits(isl: IslandDef, x: number, y: number, pad: number): boolean {
  return Math.abs(x - isl.x) <= isl.w / 2 - 26 - pad &&
    Math.abs(y - isl.y) <= isl.h / 2 - 26 - pad && !blocked(x, y, pad);
}

function randomTimer(rng: () => number, range: [number, number]): number {
  return range[0] + rng() * (range[1] - range[0]);
}

// ============================================================================
// Geração única por ilha
// ============================================================================
function buildDecor(isl: IslandDef): Decor {
  const rng = mulberry32(hashStr(isl.id));
  const pal = PALETTES[isl.id] ?? PAL_HUB;
  const profile = TERRAIN_PROFILES[isl.id] ?? MEADOW;
  const area = isl.w * isl.h;

  const decor: Decor = {
    pal,
    patchesLight: [],
    patchesDark: [],
    tufts: [[], [], []],
    flowers: [],
    accents: [],
    mushrooms: [],
    pebbles: [],
    glints: [],
    vines: [],
    fireflies: [],
    petals: [],
    shadows: [],
    fauna: []
  };

  const nPatch = Math.floor(area / 20000);
  for (let i = 0; i < nPatch; i++) {
    const p = pick(rng, isl, -30, 20);
    if (!p) continue;
    const rx = 26 + rng() * 44;
    const patch: Patch = { x: p[0], y: p[1], rx, ry: rx * (0.5 + rng() * 0.15) };
    (rng() < 0.55 ? decor.patchesLight : decor.patchesDark).push(patch);
  }

  for (let g = 0; g < profile.grassPatches; g++) {
    const c = pick(rng, isl, 15, 55);
    if (!c || !decorFits(isl, c[0], c[1], 13)) continue;
    const span = 18 + rng() * 42;
    const kind = profile.grassKinds[Math.floor(rng() * profile.grassKinds.length)];
    const n = 4 + Math.floor(rng() * 10);
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU;
      const r = Math.sqrt(rng()) * span;
      const x = c[0] + Math.cos(a) * r;
      const y = c[1] + Math.sin(a) * r * 0.62;
      const h = 4 + rng() * profile.grassHeight * (1 - r / span * 0.4);
      if (!decorFits(isl, x, y, h + 3)) continue;
      decor.tufts[Math.floor(rng() * 3)].push({ x, y, h, spread: 0.4 + rng() * 0.65, ph: rng() * TAU, kind });
    }
  }

  for (let g = 0; g < profile.flowerPatches; g++) {
    const c = pick(rng, isl, 22, 65);
    if (!c) continue;
    const col = Math.floor(rng() * pal.flowers.length);
    const kinds = profile.flowerKinds;
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const span = 21 + rng() * 28;
    const n = 3 + Math.floor(rng() * 7);
    for (let i = 0; i < n; i++) {
      const x = c[0] + (rng() * 2 - 1) * span;
      const y = c[1] + (rng() * 2 - 1) * span * 0.55;
      const h = 6 + rng() * (isl.id === 'hub' ? 21 : 13);
      if (!decorFits(isl, x, y, h + 7)) continue;
      decor.flowers.push({
        x, y, h,
        ph: rng() * TAU,
        size: 0.62 + rng() * 0.75,
        kind: rng() < 0.82 ? kind : kinds[Math.floor(rng() * kinds.length)],
        col: rng() < 0.75 ? col : Math.floor(rng() * pal.flowers.length)
      });
    }
  }
  decor.flowers.sort((a, b) => a.y - b.y);

  for (let g = 0; g < profile.accents; g++) {
    const c = pick(rng, isl, 26, 65);
    if (!c || !decorFits(isl, c[0], c[1], 25)) continue;
    const n = 1 + Math.floor(rng() * 4);
    const angle = rng() * TAU;
    for (let i = 0; i < n; i++) {
      const x = c[0] + Math.cos(angle) * i * 19 + (rng() - 0.5) * 10;
      const y = c[1] + Math.sin(angle) * i * 13 + (rng() - 0.5) * 8;
      const size = (i === 0 ? 0.92 : 0.55) + rng() * 0.54;
      if (decorFits(isl, x, y, 29 * size)) {
        decor.accents.push({ x, y, size, kind: profile.accentKind, variant: rng() });
      }
    }
  }
  decor.accents.sort((a, b) => a.y - b.y);

  const nMush = isl.id === 'hub' ? Math.floor(area / 60000) : 0;
  for (let g = 0; g < nMush; g++) {
    const c = pick(rng, isl, 30, 60);
    if (!c) continue;
    const cap = Math.floor(rng() * CAP_COLORS.length);
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const x = c[0] + (i === 0 ? 0 : (rng() - 0.5) * 24);
      const y = c[1] + (i === 0 ? 0 : rng() * 8);
      if (!decorFits(isl, x, y, 18)) continue;
      decor.mushrooms.push({ x, y, r: i === 0 ? 5.5 + rng() * 2 : 3.5 + rng() * 2, ph: rng() * TAU, cap });
    }
  }
  decor.mushrooms.sort((a, b) => a.y - b.y);

  const nPebble = Math.floor(area / 30000);
  for (let i = 0; i < nPebble; i++) {
    const p = pick(rng, isl, 10, 44);
    if (!p || !decorFits(isl, p[0], p[1], 6)) continue;
    decor.pebbles.push({ x: p[0], y: p[1], rx: 2.2 + rng() * 2.8 });
  }

  const nGlint = Math.floor(area / 14000);
  for (let i = 0; i < nGlint; i++) {
    const p = pick(rng, isl, 0, 40);
    if (!p || !decorFits(isl, p[0], p[1], 6)) continue;
    decor.glints.push({ x: p[0], y: p[1], ph: rng() * TAU, r: 2 + rng() * 2.4 });
  }

  const nVine = isl.id === 'west_crystal' ? 0 : Math.floor(isl.w / (isl.id === 'hub' ? 48 : 95));
  for (let i = 0; i < nVine; i++) {
    decor.vines.push({
      x: isl.x - isl.w / 2 + 60 + rng() * (isl.w - 120),
      len: 16 + rng() * 38,
      ph: rng() * TAU,
      root: rng() < (isl.id === 'east_hill' ? 0.85 : 0.3),
      bud: rng() < 0.35,
      moss: 7 + rng() * 9
    });
  }

  const nFirefly = isl.id === 'hub' ? Math.floor(area / 60000) : 0;
  for (let i = 0; i < nFirefly; i++) {
    decor.fireflies.push({
      ax: isl.x + (rng() * 2 - 1) * (isl.w / 2 - 60),
      ay: isl.y + (rng() * 2 - 1) * (isl.h / 2 - 60),
      ph: rng() * 100
    });
  }

  const nPetal = isl.id === 'hub' ? Math.floor(area / 45000) : 0;
  for (let i = 0; i < nPetal; i++) {
    decor.petals.push({
      sx: isl.x + (rng() * 2 - 1) * (isl.w / 2),
      sy: isl.y + (rng() * 2 - 1) * (isl.h / 2) - 60,
      period: 14 + rng() * 14,
      ph: rng() * TAU,
      col: Math.floor(rng() * pal.petals.length)
    });
  }

  for (let i = 0; i < 3; i++) {
    decor.shadows.push({
      ph: rng(),
      yFrac: 0.15 + rng() * 0.7,
      rx: 120 + rng() * 110,
      ry: 60 + rng() * 50,
      speed: 7 + rng() * 6
    });
  }

  // Fauna configurada para esta ilha em src/config/world.ts
  const entries = ISLAND_FAUNA_CONFIG[isl.id] ?? [];
  for (let e = 0; e < entries.length; e++) {
    const entry = entries[e];
    const species = FAUNA_SPECIES_DEF[entry.speciesId];
    if (!species) continue;

    for (let i = 0; i < entry.count; i++) {
      const spot =
        pick(rng, isl, species.airborne ? 0 : 18, 70) ?? [
          isl.x + (rng() * 2 - 1) * (isl.w * 0.3),
          isl.y + (rng() * 2 - 1) * (isl.h * 0.3)
        ];
      const staggerRatio = entry.count > 1 ? i / (entry.count - 1) : 0;
      const startFlying = species.locomotion === 'soar' || species.locomotion === 'flutter' || rng() < 0.45;
      const initialBehavior: FaunaBehavior =
        species.locomotion === 'ground_hop' || species.locomotion === 'ground_walk'
          ? rng() < 0.55
            ? 'rest'
            : 'walk'
          : startFlying
            ? 'fly'
            : 'rest';

      decor.fauna.push({
        species,
        windows: entry.windows,
        fadeHours: entry.fadeMinutes / 60,
        staggerHours: (entry.staggerMinutes / 60) * staggerRatio,
        color: species.primaryColors[(i + e) % species.primaryColors.length],
        phase: rng() * TAU * 4,
        alpha: 0,
        targetAlpha: 0,
        behavior: initialBehavior,
        stateTimer: randomTimer(
          rng,
          initialBehavior === 'rest' ? species.restDuration : species.moveDuration
        ),
        x: spot[0],
        y: spot[1],
        z: initialBehavior === 'fly' ? species.cruiseAltitude : 0,
        targetX: spot[0] + (rng() * 2 - 1) * 90,
        targetY: spot[1] + (rng() * 2 - 1) * 70,
        targetZ: initialBehavior === 'fly' ? species.cruiseAltitude : 0,
        heading: rng() * TAU,
        orbitAngle: rng() * TAU,
        orbitRadiusX: 110 + rng() * (isl.w * 0.24),
        orbitRadiusY: 75 + rng() * (isl.h * 0.22),
        orbitSpeed: (0.18 + rng() * 0.14) * (rng() < 0.5 ? 1 : -1),
        homeX: spot[0],
        homeY: spot[1],
        rainBehavior: 'outside',
        // Um animal por grupo tolera mais chuva e pode ser pego pelo primeiro trovão.
        rainPatience: i === 0 ? 33 + e * 4 : 0,
        rainTimer: 0,
        startledFor: 0
      });
    }
  }

  return decor;
}

function getDecor(isl: IslandDef): Decor {
  let d = cache.get(isl.id);
  if (!d) {
    d = buildDecor(isl);
    cache.set(isl.id, d);
  }
  return d;
}

/** Expõe agentes ativos de uma ilha para inspeção e testes automatizados. */
export function getIslandFaunaSnapshot(isl: IslandDef): readonly FaunaAgent[] {
  return getDecor(isl).fauna;
}

// ============================================================================
// Simulação Comportamental da Fauna (Relógio de Simulação + Hora Local Real)
// ============================================================================
function chooseWaypoint(isl: IslandDef, agent: FaunaAgent): void {
  const hw = isl.w / 2 - 68;
  const hh = isl.h / 2 - 68;

  if (agent.species.locomotion === 'soar') {
    agent.orbitAngle += (0.8 + Math.random() * 0.9) * Math.sign(agent.orbitSpeed || 1);
    agent.targetX = clamp(
      isl.x + Math.cos(agent.orbitAngle) * agent.orbitRadiusX,
      isl.x - hw,
      isl.x + hw
    );
    agent.targetY = clamp(
      isl.y + Math.sin(agent.orbitAngle) * agent.orbitRadiusY,
      isl.y - hh,
      isl.y + hh
    );
    return;
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const radius = agent.species.airborne ? 150 : 115;
    const ang = Math.random() * TAU;
    const dist = 35 + Math.random() * radius;
    const tx = clamp(agent.x + Math.cos(ang) * dist, isl.x - hw, isl.x + hw);
    const ty = clamp(agent.y + Math.sin(ang) * dist, isl.y - hh, isl.y + hh);
    if (agent.species.airborne || !blocked(tx, ty, 16)) {
      agent.targetX = tx;
      agent.targetY = ty;
      return;
    }
  }

  agent.targetX = isl.x;
  agent.targetY = isl.y;
}

function chooseRainShelter(isl: IslandDef, a: FaunaAgent, resources: readonly ResourceNode[]): void {
  const canFly = a.species.airborne || a.species.locomotion === 'songbird';
  let bestDistance = Infinity;
  const consider = (x: number, y: number): void => {
    const distance = Math.hypot(x - a.x, y - a.y);
    if (distance >= bestDistance) return;
    if (!canFly && blocked(x, y, 9)) return;
    if (!canFly) {
      for (let step = 16; step < distance; step += 16) {
        const p = step / distance;
        if (blocked(a.x + (x - a.x) * p, a.y + (y - a.y) * p, 9)) return;
      }
    }
    bestDistance = distance;
    a.targetX = x;
    a.targetY = y;
  };

  for (const node of resources) {
    if (node.islandId === isl.id && !node.depleted) {
      consider(node.x, node.y - (node.type === 'tree' ? 19 : 9));
    }
  }
  if (bestDistance === Infinity) {
    // A borda dá saída aos bichos se nenhum abrigo estiver acessível.
    const hw = isl.w / 2 - 27;
    const hh = isl.h / 2 - 27;
    const x = clamp(a.x, isl.x - hw + 28, isl.x + hw - 28);
    const y = clamp(a.y, isl.y - hh + 28, isl.y + hh - 28);
    consider(isl.x - hw, y);
    consider(isl.x + hw, y);
    consider(x, isl.y - hh);
    consider(x, isl.y + hh);
    if (bestDistance === Infinity) {
      a.targetX = a.x;
      a.targetY = a.y;
    }
  }
  a.behavior = canFly ? 'fly' : 'walk';
}

function updateFaunaInRain(
  isl: IslandDef,
  a: FaunaAgent,
  dt: number,
  weather: WeatherSnapshot,
  resources: readonly ResourceNode[],
  reactionDelay: number
): boolean {
  if (weather.level === 0) {
    if (a.rainBehavior === 'outside') {
      a.rainTimer = 0;
      return false;
    }
    if (a.rainBehavior === 'seeking') {
      a.rainBehavior = 'outside';
      a.stateTimer = 0;
      a.startledFor = 0;
      return false;
    }
    a.rainTimer -= dt;
    if (a.rainTimer <= 0 && a.targetAlpha > 0.002) {
      a.rainBehavior = 'outside';
      a.stateTimer = 0;
      return false;
    }
    a.targetAlpha = 0;
    return true;
  }

  if (a.rainBehavior === 'outside') {
    a.rainTimer += dt;
    const startled = weather.level === 3 && (weather.flash > 0.12 || weather.thunder > 0);
    if (a.alpha <= 0.01) {
      a.rainBehavior = 'sheltered';
      a.rainTimer = 0.9 + reactionDelay * 1.7;
    } else if (startled || a.rainTimer >= reactionDelay + a.rainPatience) {
      a.rainBehavior = 'seeking';
      chooseRainShelter(isl, a, resources);
    } else {
      return false;
    }
  }

  if (a.rainBehavior === 'sheltered') {
    a.targetAlpha = 0;
    return true;
  }

  if (weather.level === 3 && (weather.flash > 0.12 || weather.thunder > 0)) {
    a.startledFor = 2.1;
  } else {
    a.startledFor = Math.max(0, a.startledFor - dt);
  }
  const dx = a.targetX - a.x;
  const dy = a.targetY - a.y;
  const distance = Math.hypot(dx, dy);
  const speed = a.species.speed * (a.startledFor > 0 ? 2.25 : 1.32);
  const travel = Math.min(distance, speed * dt);
  if (distance > 0) {
    a.heading = Math.atan2(dy, dx);
    a.x += dx / distance * travel;
    a.y += dy / distance * travel;
  }
  const altitude = a.behavior === 'fly' ? a.species.cruiseAltitude * Math.min(1, distance / 46) : 0;
  a.z += (altitude - a.z) * Math.min(1, dt * 5);
  if (distance <= travel + 2) {
    a.rainBehavior = 'sheltered';
    a.rainTimer = 0.9 + reactionDelay * 1.7;
    a.startledFor = 0;
    a.behavior = 'rest';
    a.targetZ = 0;
    a.targetAlpha = 0;
  }
  return true;
}

export function updateIslandFauna(
  isl: IslandDef,
  unlocked: boolean,
  dt: number,
  localHourDecimal: number,
  focus?: FocusPoint,
  immediate: boolean = false,
  weather: WeatherSnapshot = CLEAR_WEATHER,
  resources: readonly ResourceNode[] = []
): void {
  const d = getDecor(isl);
  if (d.fauna.length === 0) return;

  const hw = isl.w / 2 - 44;
  const hh = isl.h / 2 - 44;

  for (let i = 0; i < d.fauna.length; i++) {
    const a = d.fauna[i];
    const sp = a.species;

    a.targetAlpha = unlocked
      ? evaluateSpeciesPresence(localHourDecimal, a.windows, a.fadeHours, a.staggerHours)
      : 0;

    const delay = 0.45 + ((i * 7 + isl.id.length) % 11) * 0.43;
    const weatherManaged = unlocked && updateFaunaInRain(isl, a, dt, weather, resources, delay);
    if (immediate && !weatherManaged) {
      a.alpha = a.targetAlpha;
    } else {
      const rate = a.targetAlpha > a.alpha ? 1.4 : 1.1;
      a.alpha += (a.targetAlpha - a.alpha) * Math.min(1, dt * rate);
      if (Math.abs(a.targetAlpha - a.alpha) < 0.004) a.alpha = a.targetAlpha;
    }

    if (a.alpha <= 0.002 && a.targetAlpha <= 0.002) {
      continue;
    }

    a.phase += dt * (a.startledFor > 0 ? 6 : 1);
    if (weatherManaged) continue;
    a.stateTimer -= dt;

    // Reação suave se o jogador se aproximar de animais terrestres ou pássaros pousados
    if (focus && a.z < 6 && a.behavior !== 'fly') {
      const dx = a.x - focus.x;
      const dy = a.y - focus.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 76 && dist > 0.1) {
        const away = Math.atan2(dy, dx);
        a.targetX = clamp(a.x + Math.cos(away) * 95, isl.x - hw, isl.x + hw);
        a.targetY = clamp(a.y + Math.sin(away) * 95, isl.y - hh, isl.y + hh);
        if (sp.locomotion === 'songbird' || sp.locomotion === 'flutter') {
          a.behavior = 'fly';
          a.targetZ = sp.cruiseAltitude;
          a.stateTimer = 1.6;
        } else {
          a.behavior = 'walk';
          a.stateTimer = 1.3;
        }
      }
    }

    // Transição entre ciclos de repouso, caminhada e voo
    if (a.stateTimer <= 0) {
      if (a.behavior === 'rest') {
        if (sp.locomotion === 'ground_hop' || sp.locomotion === 'ground_walk') {
          a.behavior = 'walk';
          a.targetZ = 0;
        } else {
          a.behavior = 'fly';
          a.targetZ = sp.cruiseAltitude;
        }
        chooseWaypoint(isl, a);
        a.stateTimer = sp.moveDuration[0] + Math.random() * (sp.moveDuration[1] - sp.moveDuration[0]);
      } else {
        // Aves planadoras permanecem voando a maior parte do tempo, pousando ocasionalmente
        const shouldRest = sp.locomotion === 'soar' ? Math.random() < 0.25 : true;
        if (shouldRest) {
          a.behavior = 'rest';
          a.targetZ = sp.locomotion === 'nocturnal_glow' ? sp.cruiseAltitude * 0.65 : 0;
          a.stateTimer = sp.restDuration[0] + Math.random() * (sp.restDuration[1] - sp.restDuration[0]);
        } else {
          chooseWaypoint(isl, a);
          a.stateTimer = sp.moveDuration[0] + Math.random() * (sp.moveDuration[1] - sp.moveDuration[0]);
        }
      }
    }

    // Saída gradual de cena quando a janela horária está encerrando
    const isDeparting = a.targetAlpha < 0.15 && a.alpha > 0.02;
    if (isDeparting && sp.airborne) {
      a.behavior = 'fly';
      a.targetZ = sp.cruiseAltitude + 26 * (1 - a.alpha);
    }

    // Atualização cinemática conforme estado
    if (a.behavior === 'fly') {
      if (sp.locomotion === 'soar' && !isDeparting) {
        a.orbitAngle += (sp.speed / Math.max(a.orbitRadiusX, a.orbitRadiusY, 1)) * dt;
        const ox = isl.x + Math.cos(a.orbitAngle) * a.orbitRadiusX;
        const oy = isl.y + Math.sin(a.orbitAngle) * a.orbitRadiusY;
        const dx = ox - a.x;
        const dy = oy - a.y;
        a.heading = Math.atan2(dy, dx);
        a.x += dx * Math.min(1, dt * 1.4);
        a.y += dy * Math.min(1, dt * 1.4);
        a.z += (a.targetZ + Math.sin(a.phase * 1.3) * 5 - a.z) * Math.min(1, dt * 2.2);
      } else {
        const dx = a.targetX - a.x;
        const dy = a.targetY - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 14) {
          chooseWaypoint(isl, a);
        } else {
          a.heading = Math.atan2(dy, dx);
          const flutter = sp.locomotion === 'flutter' ? Math.sin(a.phase * 3.4) * 14 : 0;
          const perp = a.heading + Math.PI / 2;
          a.x += (Math.cos(a.heading) * sp.speed + Math.cos(perp) * flutter) * dt;
          a.y += (Math.sin(a.heading) * sp.speed + Math.sin(perp) * flutter) * dt;
        }
        a.z += (a.targetZ - a.z) * Math.min(1, dt * 3.0);
      }
    } else if (a.behavior === 'walk') {
      const dx = a.targetX - a.x;
      const dy = a.targetY - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        a.behavior = 'rest';
        a.stateTimer = sp.restDuration[0];
      } else {
        a.heading = Math.atan2(dy, dx);
        const hopBurst =
          sp.locomotion === 'ground_hop' ? 0.45 + 0.95 * Math.abs(Math.sin(a.phase * 7.5)) : 1;
        const nx = a.x + Math.cos(a.heading) * sp.speed * hopBurst * dt;
        const ny = a.y + Math.sin(a.heading) * sp.speed * hopBurst * dt;
        if (!blocked(nx, ny, 14)) {
          a.x = clamp(nx, isl.x - hw, isl.x + hw);
          a.y = clamp(ny, isl.y - hh, isl.y + hh);
        } else {
          chooseWaypoint(isl, a);
        }
      }
      a.z += (0 - a.z) * Math.min(1, dt * 6);
    } else {
      // rest
      a.z += (a.targetZ - a.z) * Math.min(1, dt * 3.2);
    }
  }
}

// ============================================================================
// Desenho dos Animais por Espécie
// ============================================================================
function drawAnimal(ctx: CanvasRenderingContext2D, a: FaunaAgent, t: number): void {
  const sp = a.species;
  const dir = Math.cos(a.heading) >= 0 ? 1 : -1;
  const groundY = a.y;
  const drawY = a.y - a.z;

  // Sombra de contato no chão (sempre visível para ancorar profundidade)
  const shadowScale = clamp(1 - a.z / 95, 0.42, 1);
  ctx.fillStyle = 'rgba(18, 34, 22, 0.20)';
  ctx.beginPath();
  ctx.ellipse(
    a.x,
    groundY + 3,
    (sp.locomotion === 'soar' ? 7.5 : 4.5) * sp.scale * shadowScale,
    (sp.locomotion === 'soar' ? 3.0 : 1.9) * sp.scale * shadowScale,
    0,
    0,
    TAU
  );
  ctx.fill();

  ctx.save();
  ctx.translate(a.x, drawY);
  ctx.scale(dir * sp.scale, sp.scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (sp.locomotion === 'flutter' || sp.locomotion === 'nocturnal_glow') {
    const isMoving = a.behavior === 'fly';
    const flapFreq = isMoving ? 13 : 3.2;
    const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * flapFreq + a.phase));
    const w = (sp.locomotion === 'nocturnal_glow' ? 5.6 : 4.6) * flap;

    if (sp.glowColor) {
      ctx.fillStyle = sp.glowColor;
      ctx.globalAlpha *= 0.24;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.globalAlpha /= 0.24;
    }

    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.ellipse(-w * 0.65, -1.6, w, 3.5, -0.35, 0, TAU);
    ctx.ellipse(w * 0.65, -1.6, w, 3.5, 0.35, 0, TAU);
    ctx.ellipse(-w * 0.55, 2.0, w * 0.78, 2.4, 0.3, 0, TAU);
    ctx.ellipse(w * 0.55, 2.0, w * 0.78, 2.4, -0.3, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(-w * 0.72, -2, 0.9, 0, TAU);
    ctx.arc(w * 0.72, -2, 0.9, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = sp.accentColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(0, 3);
    ctx.stroke();
  } else if (sp.locomotion === 'songbird') {
    const hop = a.behavior === 'walk' ? Math.abs(Math.sin(t * 14 + a.phase)) * 3.5 : 0;
    const wingBeat = a.behavior === 'fly' ? Math.sin(t * 22 + a.phase) * 5.5 : 0;
    ctx.translate(0, -hop);

    // Corpo + cabeça
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.ellipse(0, -2, 5.2, 3.8, -0.15, 0, TAU);
    ctx.arc(4.2, -4.6, 2.9, 0, TAU);
    ctx.fill();

    // Peito claro
    ctx.fillStyle = sp.accentColor;
    ctx.beginPath();
    ctx.ellipse(1.5, -1.3, 3.2, 2.3, 0.2, 0, TAU);
    ctx.fill();

    // Cauda e asa
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(-4.5, -2.5);
    ctx.lineTo(-9.2, -4.4);
    ctx.lineTo(-8.4, -1.2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-0.4, -2.8 - wingBeat * 0.35, 3.8, 2.0, -0.3 + wingBeat * 0.08, 0, TAU);
    ctx.fill();

    // Bico e olho
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(6.8, -4.9);
    ctx.lineTo(9.4, -4.2);
    ctx.lineTo(6.8, -3.6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(5.1, -5.1, 0.85, 0, TAU);
    ctx.fill();
  } else if (sp.locomotion === 'soar') {
    const isFlying = a.behavior === 'fly';
    // Alterna trechos planando (asa aberta firme) com batidas suaves periódicas
    const glideCycle = Math.sin(t * 1.1 + a.phase);
    const wingY = isFlying
      ? glideCycle > 0.35
        ? Math.sin(t * 11 + a.phase) * 5.2
        : Math.sin(t * 2.2 + a.phase) * 1.4
      : 1.5;

    if (sp.glowColor) {
      ctx.fillStyle = sp.glowColor;
      ctx.globalAlpha *= 0.2;
      ctx.beginPath();
      ctx.arc(0, -2, 13, 0, TAU);
      ctx.fill();
      ctx.globalAlpha /= 0.2;
    }

    // Asa de trás
    ctx.strokeStyle = sp.accentColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-1, -3);
    ctx.quadraticCurveTo(-5, -8 - wingY * 0.8, -11, -5 - wingY);
    ctx.stroke();

    // Corpo
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.ellipse(0, -2.5, 6.8, 3.2, -0.08, 0, TAU);
    ctx.arc(5.6, -3.8, 2.6, 0, TAU);
    ctx.fill();

    // Asa da frente
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(0.5, -2.5);
    ctx.quadraticCurveTo(-3.5, -8.5 + wingY * 0.85, -10.5, -4.5 + wingY);
    ctx.stroke();

    // Bico e olho
    ctx.fillStyle = sp.id === 'ether_owl' ? '#fde047' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(6.3, -4.1, sp.id === 'ether_owl' ? 1.1 : 0.8, 0, TAU);
    ctx.fill();
  } else if (sp.locomotion === 'ground_hop') {
    // Lebre da Colina
    const hop = a.behavior === 'walk' ? Math.abs(Math.sin(t * 11 + a.phase)) * 4.5 : 0;
    const earTwitch = Math.sin(t * 3.1 + a.phase) * 0.14;
    ctx.translate(0, -hop);

    // Orelhas
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.ellipse(2.6, -9.8, 1.3, 4.2, -0.22 + earTwitch, 0, TAU);
    ctx.ellipse(4.2, -9.5, 1.3, 4.0, 0.08 - earTwitch, 0, TAU);
    ctx.fill();

    // Corpo + cabeça + rabinho
    ctx.beginPath();
    ctx.ellipse(-0.8, -3.4, 5.8, 4.1, -0.1, 0, TAU);
    ctx.arc(4.2, -5.2, 3.1, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(-6.6, -3.6, 1.9, 0, TAU);
    ctx.fill();

    // Olho e focinho
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.arc(5.1, -5.6, 0.85, 0, TAU);
    ctx.fill();
    ctx.fillStyle = sp.accentColor;
    ctx.beginPath();
    ctx.arc(7.1, -4.8, 0.8, 0, TAU);
    ctx.fill();
  } else {
    // Ouriço Ferrugem (ground_walk)
    const step = a.behavior === 'walk' ? Math.sin(t * 14 + a.phase) * 0.9 : 0;
    ctx.translate(0, step * 0.4);

    // Espinhos dorsais
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.ellipse(-1.2, -3.4, 6.2, 4.3, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();

    // Barriga e focinho claro
    ctx.fillStyle = sp.accentColor;
    ctx.beginPath();
    ctx.ellipse(0.4, -2.0, 5.8, 2.5, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(6.2, -2.2, 0.9, 0, TAU);
    ctx.arc(4.2, -3.1, 0.75, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// Peças de desenho do terreno
// ============================================================================
function drawFlower(ctx: CanvasRenderingContext2D, f: Flower, t: number, pal: Palette, bend: number): void {
  const sway = Math.sin(t * 1.4 + f.ph) * 1.5 + Math.sin(t * 0.8 + f.x * 0.01) * 1.1 + bend;
  const hx = f.x + sway;
  const hy = f.y - f.h + Math.abs(bend) * 0.25;

  ctx.strokeStyle = pal.stem;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.quadraticCurveTo(f.x + sway * 0.2, f.y - f.h * 0.6, hx, hy);
  ctx.stroke();

  ctx.fillStyle = pal.leaf;
  ctx.beginPath();
  ctx.ellipse(f.x + sway * 0.15 + 2.4, f.y - f.h * 0.35, 2.7, 1.1, -0.5, 0, TAU);
  ctx.fill();

  const col = pal.flowers[f.col];
  const pulse = 1 + Math.sin(t * 2.1 + f.ph) * 0.07;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(f.size, f.size);
  ctx.fillStyle = col;

  if (f.kind === 0) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5 + sway * 0.05;
      const px = Math.cos(a) * 3.1 * pulse;
      const py = Math.sin(a) * 2.8 * pulse;
      ctx.moveTo(px + 2.5, py);
      ctx.arc(px, py, 2.5, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = '#ffd35c';
    ctx.beginPath();
    ctx.arc(0, 0, 1.9, 0, TAU);
    ctx.fill();
  } else if (f.kind === 1) {
    const r = 3 * pulse;
    ctx.beginPath();
    ctx.moveTo(-2.2 + r, 0.6);
    ctx.arc(-2.2, 0.6, r, 0, TAU);
    ctx.moveTo(2.2 + r, 0.6);
    ctx.arc(2.2, 0.6, r, 0, TAU);
    ctx.moveTo(r, -1.8);
    ctx.arc(0, -1.8, r, 0, TAU);
    ctx.fill();
  } else if (f.kind === 2) {
    const w = 3.2 * pulse;
    ctx.beginPath();
    ctx.moveTo(-w, -1);
    ctx.lineTo(-w * 0.5, -4.6);
    ctx.lineTo(0, -1.8);
    ctx.lineTo(w * 0.5, -4.6);
    ctx.lineTo(w, -1);
    ctx.quadraticCurveTo(w, 3.6, 0, 3.8);
    ctx.quadraticCurveTo(-w, 3.6, -w, -1);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const rx = (1.6 + i * 0.65) * pulse;
      const y = i * 3.3 - 5.5;
      ctx.moveTo(rx, y);
      ctx.ellipse(0, y, rx, 1.8, 0, 0, TAU);
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawAccent(ctx: CanvasRenderingContext2D, a: Accent, t: number): void {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale(a.variant < 0.5 ? a.size : -a.size, a.size);
  ctx.fillStyle = 'rgba(19,39,34,0.23)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 19, 6, 0, 0, TAU);
  ctx.fill();

  if (a.kind === 'shrub') {
    const tall = a.variant > 0.64;
    ctx.fillStyle = '#346647';
    ctx.beginPath();
    ctx.moveTo(-19, 1);
    ctx.bezierCurveTo(-23, -8, -16, -14, -10, -11);
    ctx.bezierCurveTo(-14, tall ? -31 : -21, 5, tall ? -32 : -22, 7, -14);
    ctx.bezierCurveTo(17, -20, 24, -7, 17, 1);
    ctx.quadraticCurveTo(0, 9, -19, 1);
    ctx.fill();
    ctx.fillStyle = tall ? '#659d56' : '#72a65b';
    ctx.beginPath();
    ctx.ellipse(-5, tall ? -18 : -13, tall ? 6 : 9, 4.6, -0.55, 0, TAU);
    ctx.moveTo(16, -8);
    ctx.ellipse(11, -8, 5, 2.8, -0.35, 0, TAU);
    ctx.fill();
  } else if (a.kind === 'reeds') {
    ctx.strokeStyle = '#52775b';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const sway = Math.sin(t * 1.7 + a.x * 0.04) * 3;
    for (let i = 0; i < 5; i++) {
      const tip = -7 + i * 5 + sway;
      const height = 11 + (i % 3) * 6 + a.variant * 5;
      ctx.moveTo((i - 2) * 3, 2);
      ctx.quadraticCurveTo((i - 2) * 3, -height * 0.65, tip, -height);
    }
    ctx.stroke();
    ctx.strokeStyle = '#c6bc85';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 1; i < 5; i++) {
      const tip = -7 + i * 5 + sway;
      const height = 11 + (i % 3) * 6 + a.variant * 5;
      ctx.moveTo(tip - 2, -height + 4);
      ctx.lineTo(tip + 1, -height - 3);
    }
    ctx.stroke();
  } else if (a.kind === 'crystal') {
    const peak = -12 - a.variant * 10;
    ctx.fillStyle = '#435672';
    ctx.beginPath();
    ctx.moveTo(-19, 3);
    ctx.lineTo(-15, -8);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-2, peak + 4);
    ctx.lineTo(5, peak);
    ctx.lineTo(12, peak + 4);
    ctx.lineTo(9, -5);
    ctx.lineTo(17, -9);
    ctx.lineTo(21, -5);
    ctx.lineTo(14, 4);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8699b3';
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(-2, peak + 4);
    ctx.lineTo(5, peak);
    ctx.lineTo(12, peak + 4);
    ctx.lineTo(3, peak + 6);
    ctx.lineTo(1, 5);
    ctx.closePath();
    ctx.moveTo(9, -5);
    ctx.lineTo(17, -9);
    ctx.lineTo(21, -5);
    ctx.lineTo(12, -2);
    ctx.closePath();
    ctx.fill();
  } else {
    // Silhueta baixa e faces foscas para diferenciar os afloramentos dos nós de coleta.
    const peak = -10 - a.variant * 5;
    ctx.fillStyle = '#595647';
    ctx.beginPath();
    ctx.moveTo(-20, 2);
    ctx.lineTo(-13, -7);
    ctx.lineTo(-4, -6);
    ctx.lineTo(5, peak);
    ctx.lineTo(13, peak + 1);
    ctx.lineTo(19, -4);
    ctx.lineTo(15, 4);
    ctx.lineTo(-11, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#94846f';
    ctx.beginPath();
    ctx.moveTo(-19, 2);
    ctx.lineTo(-13, -7);
    ctx.lineTo(-4, -6);
    ctx.lineTo(5, peak);
    ctx.lineTo(13, peak + 1);
    ctx.lineTo(7, -5);
    ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#b37f61';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -1);
    ctx.lineTo(7, -5);
    ctx.lineTo(13, peak + 1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMushroom(ctx: CanvasRenderingContext2D, m: Mushroom, t: number): void {
  const r = m.r;
  const sq = Math.sin(t * 1.9 + m.ph) * 0.035;

  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(1 - sq, 1 + sq);

  ctx.fillStyle = 'rgba(20,40,20,0.22)';
  ctx.beginPath();
  ctx.ellipse(0.8, 1, r * 1.3, r * 0.45, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#f6e9cf';
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, 0);
  ctx.lineTo(-r * 0.3, -r * 1.2);
  ctx.lineTo(r * 0.3, -r * 1.2);
  ctx.lineTo(r * 0.42, 0);
  ctx.quadraticCurveTo(0, r * 0.3, -r * 0.42, 0);
  ctx.fill();

  ctx.fillStyle = CAP_COLORS[m.cap];
  ctx.beginPath();
  ctx.ellipse(0, -r * 1.15, r * 1.35, r * 1.0, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(-r * 0.55, -r * 1.55, r * 0.2, 0, TAU);
  ctx.arc(r * 0.35, -r * 1.8, r * 0.17, 0, TAU);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// API Pública de Renderização do Terreno, Iluminação e Fauna
// ============================================================================

export function drawIslandHangings(
  ctx: CanvasRenderingContext2D,
  isl: IslandDef,
  t: number,
  view?: ViewRect
): void {
  if (!islandVisible(isl, view, 80)) return;
  const d = getDecor(isl);
  const pal = d.pal;
  const base = isl.y + isl.h / 2 + 22;
  const baseAlpha = ctx.globalAlpha;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < d.vines.length; i++) {
    const v = d.vines[i];
    if (!inView(view, v.x, base + v.len * 0.5, 60)) continue;

    ctx.fillStyle = pal.leaf;
    ctx.globalAlpha = baseAlpha * 0.5;
    ctx.beginPath();
    ctx.ellipse(v.x, base + 1, v.moss * 0.7, v.moss * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = baseAlpha;

    const s1 = Math.sin(t * 1.0 + v.ph + v.x * 0.01) * 3.2;
    const s2 = Math.sin(t * 1.3 + v.ph + 0.8) * 4.6;
    const p2x = v.x + s1;
    const p2y = base + v.len * 0.62;
    const p3x = v.x + s2;
    const p3y = base + v.len;

    ctx.strokeStyle = v.root ? '#6b4a2f' : pal.vine;
    ctx.lineWidth = v.root ? 2 : 2.4;
    ctx.beginPath();
    ctx.moveTo(v.x, base);
    ctx.quadraticCurveTo(v.x + s1 * 0.2, base + v.len * 0.3, p2x, p2y);
    ctx.quadraticCurveTo(p2x + s2 * 0.3, base + v.len * 0.85, p3x, p3y);
    ctx.stroke();

    if (!v.root) {
      ctx.fillStyle = pal.leaf;
      ctx.beginPath();
      ctx.ellipse(p2x + 3, p2y - 2, 3.4, 1.6, 0.6 + s1 * 0.05, 0, TAU);
      ctx.ellipse(p2x - 3, p2y + 3, 3.2, 1.5, -0.6 + s1 * 0.05, 0, TAU);
      ctx.ellipse(p3x + 2.4, p3y - 3, 3, 1.4, 0.5 + s2 * 0.05, 0, TAU);
      ctx.fill();
      if (v.bud) {
        ctx.fillStyle = pal.flowers[(i + 1) % pal.flowers.length];
        ctx.beginPath();
        ctx.arc(p3x, p3y + 1.5, 2.2, 0, TAU);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function nearResource(nodes: readonly ResourceNode[], x: number, y: number, padding: number): boolean {
  for (const node of nodes) {
    const r = node.radius + padding;
    const dx = node.x - x;
    const dy = node.y - y;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

export function drawIslandGround(
  ctx: CanvasRenderingContext2D,
  isl: IslandDef,
  t: number,
  view?: ViewRect,
  focus?: FocusPoint,
  lighting?: IslandLighting,
  nodes: readonly ResourceNode[] = []
): void {
  if (!islandVisible(isl, view, 40)) return;
  const d = getDecor(isl);
  const pal = d.pal;
  const baseAlpha = ctx.globalAlpha;
  const daylight = lighting?.daylight ?? 1;
  const resources = nodes.filter(node => node.islandId === isl.id);

  ctx.save();
  islandPath(ctx, isl);
  ctx.clip();

  ctx.fillStyle = 'rgba(255,255,215,0.075)';
  for (let i = 0; i < d.patchesLight.length; i++) {
    const p = d.patchesLight[i];
    if (!inView(view, p.x, p.y, p.rx)) continue;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(16,56,30,0.085)';
  for (let i = 0; i < d.patchesDark.length; i++) {
    const p = d.patchesDark[i];
    if (!inView(view, p.x, p.y, p.rx)) continue;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU);
    ctx.fill();
  }

  for (let i = 0; i < d.pebbles.length; i++) {
    const p = d.pebbles[i];
    if (!inView(view, p.x, p.y, 10) || nearResource(resources, p.x, p.y, 5)) continue;
    ctx.fillStyle = 'rgba(20,40,20,0.18)';
    ctx.beginPath();
    ctx.ellipse(p.x + 0.8, p.y + 1.2, p.rx * 1.1, p.rx * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b3b9a8';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.rx * 0.65, 0, 0, TAU);
    ctx.fill();
  }

  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const arr = d.tufts[k];
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const g = arr[i];
      if (!inView(view, g.x, g.y, 33) || nearResource(resources, g.x, g.y, 4)) continue;
      const wave = Math.sin(t * 1.1 + g.x * 0.012 + g.y * 0.006) * 1.8 + Math.sin(t * 2.3 + g.ph) * 0.6;
      const off = wave + bendFrom(g.x, g.y, focus);
      const h = g.h;
      const o = off * (h / 10);
      const spread = h * g.spread;
      if (g.kind === 'fan') {
        for (let blade = -2; blade <= 2; blade++) {
          ctx.moveTo(g.x + blade * 1.2, g.y);
          ctx.quadraticCurveTo(g.x + blade * 2 + o * 0.4, g.y - h * 0.64,
            g.x + blade * spread * 0.47 + o, g.y - h * (1.16 - Math.abs(blade) * 0.24));
        }
      } else if (g.kind === 'bent') {
        for (let blade = 0; blade < 3; blade++) {
          ctx.moveTo(g.x - blade * 2, g.y);
          ctx.quadraticCurveTo(g.x + o * 0.5, g.y - h * (1.25 - blade * 0.17),
            g.x + spread * (0.9 - blade * 0.17) + o, g.y - h * (0.8 - blade * 0.18));
        }
      } else {
        ctx.moveTo(g.x - 1.5, g.y);
        ctx.quadraticCurveTo(g.x - 3 + o * 0.3, g.y - h * 0.55, g.x - spread * 0.4 + o, g.y - h);
        ctx.moveTo(g.x + 1.5, g.y);
        ctx.quadraticCurveTo(g.x + 1 + o * 0.4, g.y - h * 0.45, g.x + spread * 0.3 + o, g.y - h * 0.74);
      }
    }
    ctx.strokeStyle = pal.blades[k];
    ctx.lineWidth = k === 1 ? 1.8 : 1.5;
    ctx.stroke();
  }

  for (const a of d.accents) {
    if (!inView(view, a.x, a.y, 46) || nearResource(resources, a.x, a.y, 24 * a.size)) continue;
    drawAccent(ctx, a, t);
  }
  for (let i = 0; i < d.mushrooms.length; i++) {
    const m = d.mushrooms[i];
    if (!inView(view, m.x, m.y, 20) || nearResource(resources, m.x, m.y, 12)) continue;
    drawMushroom(ctx, m, t);
  }
  for (let i = 0; i < d.flowers.length; i++) {
    const f = d.flowers[i];
    if (!inView(view, f.x, f.y, 42) || nearResource(resources, f.x, f.y, f.h + 5)) continue;
    drawFlower(ctx, f, t, pal, bendFrom(f.x, f.y, focus) * 0.7);
  }

  // Brilhos de sol na grama (proporcionais à luz solar do horário)
  if (daylight > 0.2) {
    ctx.strokeStyle = '#fffbe0';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < d.glints.length; i++) {
      const g = d.glints[i];
      if (!inView(view, g.x, g.y, 6) || nearResource(resources, g.x, g.y, 8)) continue;
      const s = Math.sin(t * 1.7 + g.ph);
      if (s <= 0.1) continue;
      const a = s * s * s * daylight;
      const r = g.r * (0.6 + 0.5 * a);
      ctx.globalAlpha = baseAlpha * a * 0.85;
      ctx.beginPath();
      ctx.moveTo(g.x - r, g.y);
      ctx.lineTo(g.x + r, g.y);
      ctx.moveTo(g.x, g.y - r);
      ctx.lineTo(g.x, g.y + r);
      ctx.stroke();
    }
    ctx.globalAlpha = baseAlpha;
  }

  // Sombras suaves de nuvens durante o dia/crepúsculo
  if (daylight > 0.18) {
    const left = isl.x - isl.w / 2;
    const top = isl.y - isl.h / 2;
    ctx.fillStyle = `rgba(10,34,26,${(0.04 * daylight).toFixed(4)})`;
    for (let i = 0; i < d.shadows.length; i++) {
      const s = d.shadows[i];
      const span = isl.w + s.rx * 2;
      const px = left - s.rx + ((s.ph * span + t * s.speed) % span);
      const py = top + s.yFrac * isl.h;
      ctx.beginPath();
      ctx.ellipse(px, py, s.rx, s.ry, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px, py, s.rx * 0.72, s.ry * 0.72, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Aplica a iluminação atmosférica do período sobre o terreno da ilha
 * sem escurecer recursos ou zonas de construção.
 */
export function drawIslandDaylightOverlay(
  ctx: CanvasRenderingContext2D,
  isl: IslandDef,
  lighting: IslandLighting,
  view?: ViewRect
): void {
  if (lighting.tintAlpha <= 0.005 || !islandVisible(isl, view, 40)) return;

  ctx.save();
  islandPath(ctx, isl);
  ctx.clip();
  ctx.globalAlpha = lighting.tintAlpha;
  ctx.fillStyle = lighting.tintColor;
  ctx.fillRect(isl.x - isl.w / 2, isl.y - isl.h / 2, isl.w, isl.h);

  // Luzes acolhedoras à noite/entardecer para manter praça e cristais bem legíveis
  if (lighting.lanternGlow > 0.05) {
    ctx.globalCompositeOperation = 'lighter';
    if (isl.id === 'hub') {
      ctx.globalAlpha = lighting.lanternGlow * 0.14;
      ctx.fillStyle = '#ffcf7d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 210, 150, 0, 0, TAU);
      ctx.fill();
    } else if (isl.id === 'west_crystal') {
      ctx.globalAlpha = lighting.lanternGlow * 0.16;
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.ellipse(isl.x, isl.y, 260, 195, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Desenha fauna terrestre/pousada na camada do chão (antes de árvores/personagem). */
export function drawIslandGroundFauna(
  ctx: CanvasRenderingContext2D,
  isl: IslandDef,
  unlocked: boolean,
  t: number,
  view?: ViewRect
): void {
  if (!unlocked || !islandVisible(isl, view, 80)) return;
  const d = getDecor(isl);
  const baseAlpha = ctx.globalAlpha;

  for (let i = 0; i < d.fauna.length; i++) {
    const a = d.fauna[i];
    if (a.alpha <= 0.01) continue;
    if (a.species.airborne && a.z > 6) continue;
    if (!inView(view, a.x, a.y, 32)) continue;
    ctx.globalAlpha = baseAlpha * a.alpha;
    drawAnimal(ctx, a, t);
  }
  ctx.globalAlpha = baseAlpha;
}

/** Desenha fauna aérea e partículas ambientais sincronizadas com o horário local. */
export function drawIslandAmbient(
  ctx: CanvasRenderingContext2D,
  isl: IslandDef,
  unlocked: boolean,
  t: number,
  view?: ViewRect,
  lighting?: IslandLighting
): void {
  if (!unlocked || !islandVisible(isl, view, 140)) return;
  const d = getDecor(isl);
  const pal = d.pal;
  const baseAlpha = ctx.globalAlpha;
  const petalFactor = lighting?.petalFactor ?? 1;
  const fireflyFactor = lighting?.fireflyFactor ?? 0.5;

  // Pétalas à deriva (mais presentes durante o dia e amanhecer)
  if (petalFactor > 0.03) {
    for (let i = 0; i < d.petals.length; i++) {
      const p = d.petals[i];
      const u = frac(t / p.period + p.ph);
      const x = p.sx + u * 210 + Math.sin(u * 9 + p.ph) * 16;
      const y = p.sy + u * 150 + Math.sin(u * 7 + p.ph) * 8;
      if (!inView(view, x, y, 12)) continue;
      const a = Math.sin(u * Math.PI) * petalFactor;
      if (a < 0.04) continue;
      const spin = u * TAU * 2.5 + p.ph;
      ctx.globalAlpha = baseAlpha * a * 0.9;
      ctx.fillStyle = pal.petals[p.col];
      ctx.beginPath();
      ctx.ellipse(x, y, 1.2 + 2.4 * Math.abs(Math.cos(spin)), 1.6, spin * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = baseAlpha;
  }

  // Fauna aérea configurada para a ilha (borboletas, pássaros em voo, gaivotas, mariposas, corujas)
  for (let i = 0; i < d.fauna.length; i++) {
    const a = d.fauna[i];
    if (a.alpha <= 0.01) continue;
    if (!a.species.airborne && a.z <= 6) continue;
    if (!inView(view, a.x, a.y - a.z, 42)) continue;
    ctx.globalAlpha = baseAlpha * a.alpha;
    drawAnimal(ctx, a, t);
  }
  ctx.globalAlpha = baseAlpha;

  // Vaga-lumes crepusculares e noturnos
  if (fireflyFactor > 0.04) {
    ctx.fillStyle = pal.glow;
    for (let i = 0; i < d.fireflies.length; i++) {
      const f = d.fireflies[i];
      const g = Math.sin(t * 1.6 + f.ph);
      if (g <= 0.17) continue;
      const a = g * g * fireflyFactor;
      const x = f.ax + Math.sin(t * 0.31 + f.ph) * 46 + Math.sin(t * 0.83 + f.ph * 2.1) * 14;
      const y = f.ay + Math.cos(t * 0.27 + f.ph * 1.4) * 34 + Math.sin(t * 1.1 + f.ph) * 6;
      if (!inView(view, x, y, 14)) continue;

      ctx.globalAlpha = baseAlpha * a * 0.16;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = baseAlpha * a * 0.32;
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = baseAlpha * a * 0.95;
      ctx.fillStyle = '#fffde0';
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = pal.glow;
    }
    ctx.globalAlpha = baseAlpha;
  }
}

