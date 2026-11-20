import { GameState, IslandDef, ResourceNode } from '../domain/types.ts';
import { createRandomCloudGeometry, type Cloud, type CloudPuff } from '../gameplay/WorldSystem.ts';
import { clamp } from '../core/MathUtils.ts';
import type { IslandLighting, SkyPalette } from '../core/GameClock.ts';
import type { WeatherSnapshot } from '../core/RainCycle.ts';
import {
  drawIslandAmbient,
  drawIslandDaylightOverlay,
  drawIslandGround,
  drawIslandGroundFauna,
  drawIslandHangings,
  FocusPoint,
  ViewRect
} from './world-terrain.ts';

const TAU = Math.PI * 2;

function fractional(value: number): number {
  return value - Math.floor(value);
}

type RgbTriplet = readonly [number, number, number];

interface CloudPalette {
  halo: string;
  shadow: string;
  body: string;
  highlight: string;
  alphaFactor: number;
}

const CLOUD_DAY_HALO: RgbTriplet = [216, 240, 254];
const CLOUD_DAY_SHADOW: RgbTriplet = [158, 200, 229];
const CLOUD_DAY_BODY: RgbTriplet = [238, 248, 255];
const CLOUD_DAY_HIGHLIGHT: RgbTriplet = [255, 252, 244];

const CLOUD_WARM_HALO: RgbTriplet = [246, 198, 174];
const CLOUD_WARM_SHADOW: RgbTriplet = [124, 134, 170];
const CLOUD_WARM_BODY: RgbTriplet = [248, 222, 202];
const CLOUD_WARM_HIGHLIGHT: RgbTriplet = [255, 234, 192];

const CLOUD_NIGHT_HALO: RgbTriplet = [74, 110, 148];
const CLOUD_NIGHT_SHADOW: RgbTriplet = [42, 66, 98];
const CLOUD_NIGHT_BODY: RgbTriplet = [106, 142, 180];
const CLOUD_NIGHT_HIGHLIGHT: RgbTriplet = [154, 186, 218];

function mixTriplet(a: RgbTriplet, b: RgbTriplet, t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function toRgbCss(c: RgbTriplet): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

function resolveCloudPalette(sky?: SkyPalette, lighting?: IslandLighting): CloudPalette {
  const dayFactor = lighting ? clamp((lighting.daylight - 0.12) / 0.78, 0, 1) : 1;
  const warmthFactor = sky ? clamp((sky.horizonGlowAlpha - 0.18) / 0.26, 0, 1) : 0;

  const halo = mixTriplet(mixTriplet(CLOUD_NIGHT_HALO, CLOUD_DAY_HALO, dayFactor), CLOUD_WARM_HALO, warmthFactor);
  const shadow = mixTriplet(mixTriplet(CLOUD_NIGHT_SHADOW, CLOUD_DAY_SHADOW, dayFactor), CLOUD_WARM_SHADOW, warmthFactor);
  const body = mixTriplet(mixTriplet(CLOUD_NIGHT_BODY, CLOUD_DAY_BODY, dayFactor), CLOUD_WARM_BODY, warmthFactor);
  const highlight = mixTriplet(
    mixTriplet(CLOUD_NIGHT_HIGHLIGHT, CLOUD_DAY_HIGHLIGHT, dayFactor),
    CLOUD_WARM_HIGHLIGHT,
    warmthFactor
  );

  return {
    halo: toRgbCss(halo),
    shadow: toRgbCss(shadow),
    body: toRgbCss(body),
    highlight: toRgbCss(highlight),
    alphaFactor: 0.7 + 0.3 * dayFactor
  };
}

const DEFAULT_CLOUD_GEOMETRY = createRandomCloudGeometry(() => 0.2);

function appendCloudLayerPath(
  ctx: CanvasRenderingContext2D,
  puffs: readonly CloudPuff[],
  offsetX: number,
  offsetY: number,
  scaleRx: number,
  scaleRy: number,
  padRx: number = 0,
  padRy: number = 0
): void {
  ctx.beginPath();
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    const cx = p.x + offsetX;
    const cy = p.y + offsetY;
    const rx = Math.max(1, p.rx * scaleRx + padRx);
    const ry = Math.max(1, p.ry * scaleRy + padRy);
    // Inicia cada subcaminho explicitamente para evitar linhas retas ligando os volumes.
    ctx.moveTo(cx + rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.closePath();
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class WorldRenderer {
  renderSky(ctx: CanvasRenderingContext2D, w: number, h: number, sky?: SkyPalette): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, sky?.top ?? '#193547');
    bgGrad.addColorStop(0.5, sky?.mid ?? '#234a60');
    bgGrad.addColorStop(1, sky?.horizon ?? '#183344');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    if (!sky) return;
    ctx.save();
    if (sky.horizonGlowAlpha > 0) {
      const glow = ctx.createLinearGradient(0, h * 0.45, 0, h);
      glow.addColorStop(0, 'transparent');
      glow.addColorStop(1, sky.horizonGlow);
      ctx.globalAlpha = sky.horizonGlowAlpha;
      ctx.fillStyle = glow;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
    }
    if (sky.starAlpha > 0) {
      ctx.fillStyle = '#fff4de';
      for (let i = 0; i < 64; i++) {
        ctx.globalAlpha = sky.starAlpha * (0.35 + (i % 5) * 0.12);
        ctx.fillRect(w * ((i * 613 + 53) % 997) / 997, h * ((i * 197 + 97) % 991) / 991, i % 9 === 0 ? 2 : 1, 1);
      }
    }
    ctx.restore();
  }

  renderLightning(ctx: CanvasRenderingContext2D, w: number, h: number, weather: WeatherSnapshot): void {
    if (weather.flash <= 0.02) return;
    const x = w * weather.lightningX;
    const length = Math.min(h * 0.45, 320);
    ctx.save();
    ctx.strokeStyle = '#dde9ff';
    ctx.globalAlpha = weather.flash * 0.55;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - length * 0.12, length * 0.35);
    ctx.lineTo(x + length * 0.03, length * 0.51);
    ctx.lineTo(x - length * 0.12, length);
    ctx.moveTo(x + length * 0.03, length * 0.51);
    ctx.lineTo(x + length * 0.16, length * 0.72);
    ctx.stroke();
    ctx.restore();
  }

  renderRainSplashes(
    ctx: CanvasRenderingContext2D,
    islands: readonly IslandDef[],
    view: ViewRect,
    time: number,
    rain: number
  ): void {
    if (rain <= 0.005) return;
    ctx.save();
    ctx.strokeStyle = '#c6dfdf';
    ctx.lineWidth = 0.9;
    for (const island of islands) {
      const x0 = island.x - island.w / 2 + 14;
      const x1 = island.x + island.w / 2 - 14;
      const y0 = island.y - island.h / 2 + 14;
      const y1 = island.y + island.h / 2 - 14;
      if (x0 > view.x1 || x1 < view.x0 || y0 > view.y1 || y1 < view.y0) continue;
      for (let i = 0; i < 20 + rain * 72; i++) {
        const cycle = time * 0.86 + i * 0.618034;
        const age = fractional(cycle) * 3.4;
        if (age >= 1) continue;
        const seed = i + Math.floor(cycle) * 113 + island.x * 0.13 + island.y * 0.17;
        const x = x0 + fractional(seed * 0.754877) * (x1 - x0);
        const y = y0 + fractional(seed * 0.56984) * (y1 - y0);
        if (x < view.x0 - 10 || x > view.x1 + 10 || y < view.y0 - 10 || y > view.y1 + 10) continue;
        ctx.globalAlpha = rain * 0.42 * (1 - age);
        const radius = 1 + age * 6;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.42, 0, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  renderRain(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    time: number,
    weather: WeatherSnapshot
  ): void {
    const rain = weather.intensity;
    if (rain <= 0.005) return;
    ctx.save();
    ctx.fillStyle = '#202e48';
    ctx.globalAlpha = 0.20 * rain;
    ctx.fillRect(0, 0, w, h);
    if (weather.flash > 0) {
      ctx.fillStyle = '#dce9ff';
      ctx.globalAlpha = 0.16 * weather.flash;
      ctx.fillRect(0, 0, w, h);
    }

    const dropCount = Math.ceil(clamp(w * h / 3900, 55, 460));
    ctx.strokeStyle = '#cae2eb';
    for (let layer = 0; layer < 2; layer++) {
      const density = dropCount * (0.24 + 0.76 * rain) * (layer === 0 ? 0.72 : 0.28);
      const speed = layer === 0 ? 380 : 620;
      const length = (layer === 0 ? 8 : 14) + 9 * rain;
      ctx.globalAlpha = rain * (layer === 0 ? 0.33 : 0.49);
      ctx.lineWidth = layer === 0 ? 0.75 : 1.1;
      ctx.beginPath();
      for (let i = 0; i < density; i++) {
        const seed = i + layer * 191;
        const travel = time * (speed + (i % 7) * 19) / (h + 48) + seed * 0.754877;
        const y = fractional(travel) * (h + 48) - 24;
        const x = fractional(seed * 0.618034 + Math.floor(travel) * 0.337 - y * 0.16 / (w + 48)) * (w + 48) - 24;
        ctx.moveTo(x, y);
        ctx.lineTo(x - length * 0.16, y + length);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  renderClouds(
    ctx: CanvasRenderingContext2D,
    clouds: readonly Cloud[],
    worldTime: number = 0,
    view?: ViewRect,
    sky?: SkyPalette,
    lighting?: IslandLighting
  ): void {
    if (clouds.length === 0) return;
    const palette = resolveCloudPalette(sky, lighting);
    const baseAlpha = ctx.globalAlpha;

    for (const c of clouds) {
      const puffs = c.puffs ?? DEFAULT_CLOUD_GEOMETRY.puffs;
      const bobY = Math.sin(worldTime * 0.42 + (c.bobPhase ?? 0)) * (c.bobAmp ?? 3);
      const boundW = (c.halfWidth ?? 110) * c.scale + 24;
      const boundH = (c.halfHeight ?? 70) * c.scale + 24;

      if (
        view &&
        (c.x + boundW < view.x0 ||
          c.x - boundW > view.x1 ||
          c.y + bobY + boundH < view.y0 ||
          c.y + bobY - boundH > view.y1)
      ) {
        continue;
      }

      const effAlpha = clamp(c.alpha * palette.alphaFactor, 0, 1);

      ctx.save();
      ctx.translate(c.x, c.y + bobY);
      ctx.scale(c.scale, c.scale);

      // 1. Halo atmosférico externo suave
      ctx.globalAlpha = baseAlpha * effAlpha * 0.28;
      ctx.fillStyle = palette.halo;
      appendCloudLayerPath(ctx, puffs, 0, 1, 1, 1, 6, 5);
      ctx.fill();

      // 2. Base sombreada 2.5D (luz vinda do canto superior esquerdo)
      ctx.globalAlpha = baseAlpha * effAlpha * 0.72;
      ctx.fillStyle = palette.shadow;
      appendCloudLayerPath(ctx, puffs, 2.5, 5.5, 0.98, 0.94);
      ctx.fill();

      // 3. Corpo principal da nuvem
      ctx.globalAlpha = baseAlpha * effAlpha;
      ctx.fillStyle = palette.body;
      appendCloudLayerPath(ctx, puffs, 0, 0, 1, 1);
      ctx.fill();

      // 4. Realce superior iluminado pelo sol
      ctx.globalAlpha = baseAlpha * effAlpha * 0.65;
      ctx.fillStyle = palette.highlight;
      appendCloudLayerPath(ctx, puffs, -3.5, -4.5, 0.76, 0.72);
      ctx.fill();

      ctx.restore();
    }
  }

  renderIslands(
    ctx: CanvasRenderingContext2D,
    islands: IslandDef[],
    state: GameState,
    worldTime: number = 0,
    view?: ViewRect,
    focus?: FocusPoint,
    lighting?: IslandLighting,
    nodes: readonly ResourceNode[] = []
  ): void {
    islands.forEach(isl => {
      const unlocked = isl.unlocked(state);
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.45;
      const left = isl.x - isl.w / 2;
      const top = isl.y - isl.h / 2;

      ctx.fillStyle = isl.cliffColor;
      roundRect(ctx, left + 8, top + 28, isl.w - 16, isl.h, 38);
      ctx.fill();

      // Raízes e trepadeiras balançando sob o penhasco.
      drawIslandHangings(ctx, isl, worldTime, view);

      ctx.fillStyle = isl.edgeColor;
      roundRect(ctx, left, top + 8, isl.w, isl.h, 38);
      ctx.fill();

      ctx.fillStyle = isl.topColor;
      roundRect(ctx, left, top, isl.w, isl.h, 38);
      ctx.fill();

      drawIslandGround(ctx, isl, worldTime, view, focus, lighting, nodes);

      if (isl.id === 'hub') {
        // Praça de terra batida, com borda irregular e pedras discretas.
        ctx.fillStyle = '#668b59';
        ctx.beginPath();
        ctx.ellipse(0, 8, 190, 130, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b4a477';
        ctx.beginPath();
        ctx.ellipse(0, 4, 178, 117, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c7b78a';
        ctx.beginPath();
        ctx.ellipse(0, -1, 168, 106, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lajes e pequenas marcas criam textura sem obstruir a circulação.
        const stones = [[-145, -34, 15, 8], [-121, 43, 18, 9], [-70, 69, 14, 7],
          [-22, 79, 19, 9], [35, 74, 15, 7], [93, 60, 20, 9],
          [139, 23, 14, 8], [129, -65, 16, 8], [55, -83, 17, 7],
          [-26, -81, 14, 7], [-105, -67, 17, 8]];
        for (const [sx, sy, rx, ry] of stones) {
          ctx.fillStyle = 'rgba(101, 91, 67, 0.19)';
          ctx.beginPath(); ctx.ellipse(sx + 1, sy + 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(237, 220, 175, 0.52)';
          ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(102, 83, 54, 0.25)';
        for (const [dx, dy] of [[-153, 4], [-80, -91], [8, 97], [75, -65], [150, 53], [-57, 45], [45, 39]]) {
          ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI * 2); ctx.fill();
        }
      }

      if (lighting) drawIslandDaylightOverlay(ctx, isl, lighting, view);
      drawIslandGroundFauna(ctx, isl, unlocked, worldTime, view);

      ctx.restore();
    });
  }

  /** Borboletas, vaga-lumes e pétalas: desenhadas acima de recursos e jogador. */
  renderAmbient(
    ctx: CanvasRenderingContext2D,
    islands: IslandDef[],
    state: GameState,
    worldTime: number,
    view?: ViewRect,
    lighting?: IslandLighting
  ): void {
    for (let i = 0; i < islands.length; i++) {
      const isl = islands[i];
      drawIslandAmbient(ctx, isl, isl.unlocked(state), worldTime, view, lighting);
    }
  }
}
