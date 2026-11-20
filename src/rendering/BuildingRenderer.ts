import { GameState } from '../domain/types.ts';
import { BlueprintConfig, BridgeLayout, resolveBridgeLayout } from '../config/buildings.ts';
import { roundRect } from './WorldRenderer.ts';
import { drawMerchantStall, drawWarehouse, PropState } from './world-props.ts';
import { drawConstructionSite } from './world-construction.ts';

const TAU = Math.PI * 2;
const BUILD_TRANSITION_SECONDS = 0.7;

const WOOD = {
  base: '#8f5a2c',
  light: '#c28a4c',
  highlight: '#e3aa66',
  dark: '#5f3b1d',
  outline: '#3e2210',
  ropeBase: '#d9a25a',
  ropeLight: '#f0c27a',
  ropeDark: '#6e451b',
  pennant: '#f28a2e',
  pennantActive: '#f5ca87'
} as const;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

interface BridgeGuideOptions {
  worldTime: number;
  nearbyBlueprintId?: string;
  trackedBlueprintId?: string | null;
}

interface BuildTransition {
  from: number;
  to: number;
  start: number;
}

export class BuildingRenderer {
  private buildState?: GameState;
  private readonly transitions = new Map<string, BuildTransition>();

  renderProject(
    ctx: CanvasRenderingContext2D,
    bp: BlueprintConfig,
    state: GameState,
    targetProgress: number,
    options: BridgeGuideOptions,
    showGuides: boolean
  ): void {
    if (state !== this.buildState) {
      this.buildState = state;
      this.transitions.clear();
    }

    const progress = this.getVisualProgress(bp.id, targetProgress, options.worldTime);
    const built = state.builds[bp.id]?.built;
    if (!built && !showGuides) return;

    if (bp.isBridge) {
      this.drawBridge(ctx, bp, progress, options, showGuides);
      return;
    }

    drawConstructionSite(ctx, bp, progress, { time: options.worldTime, built });
    if (built && bp.id === 'airshipDock' && progress > .86) {
      this.drawAirship(ctx, bp, state, options.worldTime, (progress - .86) / (1 - .86));
    }
    const machine = state.machines[bp.id];
    if (built && showGuides && machine && machine.progress > 0) {
      const barY = bp.y - (bp.id === 'furnace' ? 16 : 9);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bp.x + 12, barY, bp.w - 24, 5);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(bp.x + 12, barY, (bp.w - 24) * machine.progress, 5);
      ctx.restore();
    }
  }

  private getVisualProgress(id: string, target: number, time: number): number {
    const transition = this.transitions.get(id);
    if (!transition || time < transition.start) {
      this.transitions.set(id, { from: target, to: target, start: time });
      return target;
    }

    const elapsed = clamp((time - transition.start) / BUILD_TRANSITION_SECONDS, 0, 1);
    const eased = elapsed * elapsed * (3 - 2 * elapsed);
    const current = elapsed === 1 ? transition.to : transition.from + (transition.to - transition.from) * eased;
    if (target !== transition.to) {
      this.transitions.set(id, { from: current, to: target, start: time });
    }
    return current;
  }

  renderMerchantStall(ctx: CanvasRenderingContext2D, x: number, y: number, state: PropState): void {
    drawMerchantStall(ctx, x, y + 24, state);
  }

  renderWorkbenchAndWarehouse(ctx: CanvasRenderingContext2D, x: number, y: number, state: PropState): void {
    drawWarehouse(ctx, x, y + 24, state);
  }

  renderInteractionLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, screenWidth: number): void {
    ctx.save();
    const text = '[E]  ' + label;
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = Math.min(screenWidth - 12, ctx.measureText(text).width + 16);
    const centerX = clamp(x, width / 2 + 6, screenWidth - width / 2 - 6);
    const centerY = Math.max(17, y);
    roundRect(ctx, centerX - width / 2, centerY - 11, width, 22, 5);
    ctx.fillStyle = '#302820';
    ctx.fill();
    ctx.strokeStyle = '#96724c';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#e8d3ae';
    ctx.fillText(text, centerX, centerY, width - 16);
    ctx.restore();
  }

  private drawBridge(
    ctx: CanvasRenderingContext2D,
    bp: BlueprintConfig,
    progress: number,
    options: BridgeGuideOptions,
    showGuides: boolean
  ): void {
    const layout = resolveBridgeLayout(bp);
    // As cordas e estacas de obra cedem lugar ao tabuleiro no acabamento.
    const guideOpacity = showGuides ? clamp((1 - progress) / .16, 0, 1) : 0;
    if (guideOpacity === 0) {
      this.drawBridgeDeck(ctx, bp, layout, progress);
      return;
    }
    const isNear = options.nearbyBlueprintId === bp.id;
    const isTracked = options.trackedBlueprintId === bp.id;
    const emphasized = isNear || isTracked;
    const t = options.worldTime;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const opacity = ctx.globalAlpha;
    ctx.globalAlpha = opacity * guideOpacity;

    // 1. Soleira de tábuas na margem de entrada para ancorar o acesso visualmente
    this.drawEntranceThreshold(ctx, bp, layout);

    // 2. Pontos das estacas ao longo das duas bordas paralelas do futuro trajeto
    const railPad = 5;
    const span = layout.isHorizontal ? bp.w : bp.h;
    const segments = Math.max(2, Math.round(span / 54));

    const sideA: Array<{ x: number; y: number; isEntry: boolean; isEnd: boolean }> = [];
    const sideB: Array<{ x: number; y: number; isEntry: boolean; isEnd: boolean }> = [];

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      if (layout.isHorizontal) {
        const sx = bp.x + u * bp.w;
        const isLeft = i === 0;
        const isRight = i === segments;
        const isEntry = (layout.entrance === 'left' && isLeft) || (layout.entrance === 'right' && isRight);
        const isEnd = isLeft || isRight;
        sideA.push({ x: sx, y: bp.y - railPad, isEntry, isEnd });
        sideB.push({ x: sx, y: bp.y + bp.h + railPad, isEntry, isEnd });
      } else {
        const sy = bp.y + u * bp.h;
        const isTop = i === 0;
        const isBottom = i === segments;
        const isEntry = (layout.entrance === 'top' && isTop) || (layout.entrance === 'bottom' && isBottom);
        const isEnd = isTop || isBottom;
        sideA.push({ x: bp.x - railPad, y: sy, isEntry, isEnd });
        sideB.push({ x: bp.x + bp.w + railPad, y: sy, isEntry, isEnd });
      }
    }

    // 3. Corda traseira (topo se horizontal; esquerda se vertical)
    this.drawGuideRope(ctx, sideA, t, emphasized, 0);

    // 4. Estacas traseiras
    for (const pt of sideA) {
      this.drawStake(ctx, pt.x, pt.y, {
        major: pt.isEnd,
        withPennant: pt.isEntry,
        emphasized,
        time: t,
        phase: pt.x * 0.03 + pt.y * 0.03
      });
    }

    ctx.globalAlpha = opacity;
    this.drawBridgeDeck(ctx, bp, layout, progress);
    ctx.globalAlpha = opacity * guideOpacity;

    // 6. Estacas frontais
    for (const pt of sideB) {
      this.drawStake(ctx, pt.x, pt.y, {
        major: pt.isEnd,
        withPennant: pt.isEntry,
        emphasized,
        time: t,
        phase: pt.x * 0.03 + pt.y * 0.03 + 1.4
      });
    }

    // 7. Corda frontal (desenhada sobre o topo das estacas frontais)
    this.drawGuideRope(ctx, sideB, t, emphasized, 1.1);

    ctx.restore();
  }

  private drawEntranceThreshold(
    ctx: CanvasRenderingContext2D,
    bp: BlueprintConfig,
    layout: BridgeLayout
  ): void {
    ctx.save();
    const ox = layout.entryX + layout.inwardX * 8;
    const oy = layout.entryY + layout.inwardY * 8;

    ctx.fillStyle = 'rgba(20, 32, 12, 0.24)';
    if (layout.isHorizontal) {
      roundRect(ctx, ox - 8, oy - bp.h * 0.42 + 2, 16, bp.h * 0.84, 3);
      ctx.fill();

      for (let i = -1; i <= 0; i++) {
        const px = ox + i * 7 - 2;
        ctx.fillStyle = WOOD.base;
        ctx.strokeStyle = WOOD.outline;
        ctx.lineWidth = 1;
        roundRect(ctx, px, oy - bp.h * 0.4, 5.5, bp.h * 0.8, 1.5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = WOOD.light;
        ctx.fillRect(px + 1, oy - bp.h * 0.36, 1.5, bp.h * 0.72);
      }
    } else {
      roundRect(ctx, ox - bp.w * 0.42, oy - 6, bp.w * 0.84, 16, 3);
      ctx.fill();

      for (let i = -1; i <= 0; i++) {
        const py = oy + i * 7 - 2;
        ctx.fillStyle = WOOD.base;
        ctx.strokeStyle = WOOD.outline;
        ctx.lineWidth = 1;
        roundRect(ctx, ox - bp.w * 0.4, py, bp.w * 0.8, 5.5, 1.5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = WOOD.light;
        ctx.fillRect(ox - bp.w * 0.36, py + 1, bp.w * 0.72, 1.5);
      }
    }
    ctx.restore();
  }

  private drawGuideRope(
    ctx: CanvasRenderingContext2D,
    points: ReadonlyArray<{ x: number; y: number; isEnd: boolean }>,
    time: number,
    emphasized: boolean,
    phaseOffset: number
  ): void {
    if (points.length < 2) return;

    const tracePath = () => {
      ctx.beginPath();
      const firstH = points[0].isEnd ? 18 : 13;
      ctx.moveTo(points[0].x, points[0].y - firstH);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const h0 = p0.isEnd ? 18 : 13;
        const h1 = p1.isEnd ? 18 : 13;
        const mx = (p0.x + p1.x) * 0.5;
        const my = (p0.y - h0 + (p1.y - h1)) * 0.5;
        const wind = Math.sin(time * 2.1 + phaseOffset + i * 1.1) * 1.1;
        const sag = 4.5 + wind;
        ctx.quadraticCurveTo(mx, my + sag, p1.x, p1.y - h1);
      }
    };

    ctx.save();
    // Contorno escuro para leitura sobre grama e abismo
    tracePath();
    ctx.strokeStyle = WOOD.ropeDark;
    ctx.lineWidth = emphasized ? 3.4 : 2.8;
    ctx.stroke();

    // Corpo da corda
    tracePath();
    ctx.strokeStyle = emphasized ? WOOD.ropeLight : WOOD.ropeBase;
    ctx.lineWidth = emphasized ? 1.9 : 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawStake(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    opts: {
      major: boolean;
      withPennant: boolean;
      emphasized: boolean;
      time: number;
      phase: number;
    }
  ): void {
    const h = opts.major ? 22 : 16;
    const w = opts.major ? 6 : 4.5;

    ctx.save();
    ctx.translate(x, y);

    // Sombra de contato
    ctx.fillStyle = 'rgba(20, 32, 12, 0.30)';
    ctx.beginPath();
    ctx.ellipse(1, 1, w * 1.05, 2.5, 0, 0, TAU);
    ctx.fill();

    // Corpo da estaca
    ctx.fillStyle = WOOD.base;
    ctx.strokeStyle = WOOD.outline;
    ctx.lineWidth = 1;
    roundRect(ctx, -w / 2, -h, w, h, 1.5);
    ctx.fill();
    ctx.stroke();

    // Luz à esquerda e sombra à direita
    ctx.fillStyle = WOOD.light;
    ctx.fillRect(-w / 2 + 0.8, -h + 1.5, Math.max(1, w * 0.32), h - 3);
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(w / 2 - Math.max(1, w * 0.28) - 0.6, -h + 1.5, Math.max(1, w * 0.28), h - 3);

    // Nó de corda no topo
    const knotY = opts.major ? -18 : -13;
    ctx.fillStyle = WOOD.ropeBase;
    ctx.strokeStyle = WOOD.ropeDark;
    ctx.lineWidth = 0.8;
    roundRect(ctx, -w / 2 - 1, knotY - 1.5, w + 2, 3.2, 1.2);
    ctx.fill();
    ctx.stroke();

    // Flâmula de sinalização nas estacas principais de entrada
    if (opts.withPennant) {
      const flutter = Math.sin(opts.time * 3.4 + opts.phase) * 2.2;
      ctx.fillStyle = opts.emphasized ? WOOD.pennantActive : WOOD.pennant;
      ctx.strokeStyle = WOOD.outline;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(w / 2, -h + 3);
      ctx.quadraticCurveTo(w / 2 + 7, -h + 2 + flutter * 0.5, w / 2 + 13, -h + 5 + flutter);
      ctx.lineTo(w / 2 + 9, -h + 8 + flutter * 0.6);
      ctx.lineTo(w / 2, -h + 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawBridgeDeck(
    ctx: CanvasRenderingContext2D,
    bp: BlueprintConfig,
    layout: BridgeLayout,
    progress: number
  ): void {
    const span = layout.isHorizontal ? bp.w : bp.h;
    const count = Math.ceil(span / 16);
    const step = span / count;
    const visible = progress * count;
    const fromStart = layout.entrance === 'left' || layout.entrance === 'top';
    const plankSize = step - 1.5;

    ctx.save();
    const opacity = ctx.globalAlpha;
    for (let i = 0; i < Math.ceil(visible); i++) {
      const amount = Math.min(1, visible - i);
      const offset = (fromStart ? i : count - 1 - i) * step + .75;
      const x = layout.isHorizontal ? bp.x + offset : bp.x;
      const y = (layout.isHorizontal ? bp.y : bp.y + offset) - 5 * (1 - amount);
      const w = layout.isHorizontal ? plankSize : bp.w;
      const h = layout.isHorizontal ? bp.h : plankSize;

      ctx.globalAlpha = opacity * amount;
      ctx.fillStyle = WOOD.dark;
      roundRect(ctx, x, y + 4, w, h, 2);
      ctx.fill();
      ctx.fillStyle = i % 2 === 0 ? WOOD.light : WOOD.base;
      roundRect(ctx, x, y, w, h, 2);
      ctx.fill();
      ctx.fillStyle = WOOD.highlight;
      if (layout.isHorizontal) {
        ctx.fillRect(x + 2, y + 4, 1, h - 8);
      } else {
        ctx.fillRect(x + 4, y + 2, w - 8, 1);
      }
      ctx.fillStyle = WOOD.outline;
      ctx.fillRect(x + (layout.isHorizontal ? w / 2 : 6), y + (layout.isHorizontal ? 6 : h / 2), 2, 2);
      ctx.fillRect(x + (layout.isHorizontal ? w / 2 : w - 8), y + (layout.isHorizontal ? h - 8 : h / 2), 2, 2);
    }
    ctx.restore();
  }

  private drawAirship(
    ctx: CanvasRenderingContext2D,
    bp: BlueprintConfig,
    state: GameState,
    worldTime: number,
    opacity: number
  ): void {
    const air = state.airship;
    let flight = 0;
    if (air.activeRouteId && !air.completed) {
      flight = Math.sin(air.elapsed / Math.max(1, air.duration) * Math.PI);
    }
    const scale = 1 - flight * .28;
    const cx = bp.x + bp.w / 2 + flight * 95;
    const cy = bp.y + bp.h / 2 - 28 - flight * 140;

    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.translate(cx, cy + Math.sin(worldTime * 2.5) * 4);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(0, -18, 56, 26, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(0, -18, 56, 10, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    roundRect(ctx, -26, 12, 52, 16, 6);
    ctx.fill();

    const propH = Math.sin(worldTime * 32) * 14;
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 18 - propH);
    ctx.lineTo(30, 18 + propH);
    ctx.stroke();
    ctx.restore();
  }
}
