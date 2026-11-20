import { DropItem, GameState, PlayerState } from '../domain/types.ts';
import { drawDropItem, isDropVisible, nextDropSeed } from './world-drops.ts';
import type { ViewRect } from './world-terrain.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export class EffectsRenderer {
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];

  addBurst(x: number, y: number, color: string, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 85;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 2.5 + Math.random() * 3.5,
        color,
        life: 0.4 + Math.random() * 0.35,
        maxLife: 0.75
      });
    }
  }

  addFloatingText(x: number, y: number, text: string, color: string = '#fef3c7'): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 0.95
    });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 34 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  renderDrops(ctx: CanvasRenderingContext2D, drops: readonly DropItem[], worldTime: number, view: ViewRect): void {
    for (const drop of drops) {
      if (!isDropVisible(view, drop.x, drop.y, drop.z)) continue;
      drop.seed ??= nextDropSeed();
      drawDropItem(ctx, drop.resource, drop.x, drop.y, drop.z, drop.age, worldTime, drop.seed, drop.vx);
    }
  }

  renderMoveTarget(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number): void {
    if (player.moveTarget) {
      ctx.save();
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        player.moveTarget.x,
        player.moveTarget.y,
        10 + Math.sin(worldTime * 8) * 3,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  renderParticles(ctx: CanvasRenderingContext2D): void {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life * 1.4);
      ctx.font = '700 13px Inter';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }

  renderProjectTrackerArrow(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    state: GameState
  ): void {
    const tid = state.trackedBuildId;
    if (!tid) return;
    const bp = BLUEPRINTS_DEF.find(b => b.id === tid);
    if (!bp || state.builds[tid]?.built) return;

    const tx = bp.x + bp.w / 2;
    const ty = bp.y + bp.h / 2;
    const dx = tx - player.x;
    const dy = ty - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 85) return; // Já está bem em cima do projeto

    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(player.x + Math.cos(ang) * 44, player.y + Math.sin(ang) * 44);
    ctx.rotate(ang);

    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
