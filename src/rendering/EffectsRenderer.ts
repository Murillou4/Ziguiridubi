import { DerivedStats, DropItem, GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { drawDropItem, drawResourceIcon, isDropVisible, nextDropSeed } from './world-drops.ts';
import type { ViewRect } from './world-terrain.ts';
import { BLUEPRINTS_DEF, WAREHOUSE_POSITION } from '../config/buildings.ts';

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

const WAREHOUSE_MOUTH_Y = WAREHOUSE_POSITION.y - 4;

interface WarehouseTransfer {
  resource: ResourceId;
  x: number;
  y: number;
  age: number;
  duration: number;
  arcHeight: number;
}

export class EffectsRenderer {
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  private readonly warehouseTransfers: WarehouseTransfer[] = [];
  private warehouseLid = 0;
  private warehouseReceiptTime = 0;

  get warehouseOpening(): number {
    return this.warehouseLid;
  }

  addWarehouseTransfer(resource: ResourceId, player: PlayerState): void {
    const x = player.x - Math.cos(player.facing) * 8;
    const y = player.y - 12;
    const distance = Math.hypot(WAREHOUSE_POSITION.x - x, WAREHOUSE_MOUTH_Y - y);
    this.warehouseTransfers.push({
      resource,
      x,
      y,
      age: 0,
      duration: .3 + distance * .003,
      arcHeight: 24 + distance * .18 + Math.random() * 7
    });
  }

  clearWarehouseTransfers(): void {
    this.warehouseTransfers.length = 0;
    this.warehouseLid = 0;
    this.warehouseReceiptTime = 0;
  }

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

  update(dt: number, onWarehouseArrival: (resource: ResourceId) => void): void {
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

    this.warehouseReceiptTime -= dt;
    for (let i = this.warehouseTransfers.length - 1; i >= 0; i--) {
      const transfer = this.warehouseTransfers[i];
      transfer.age += dt;
      if (transfer.age < transfer.duration) continue;
      this.warehouseTransfers.splice(i, 1);
      this.warehouseReceiptTime = .18;
      this.addBurst(WAREHOUSE_POSITION.x, WAREHOUSE_MOUTH_Y, '#f6cf87', 3);
      onWarehouseArrival(transfer.resource);
    }

    const lidTarget = this.warehouseTransfers.length || this.warehouseReceiptTime > 0 ? 1 : 0;
    this.warehouseLid += (lidTarget - this.warehouseLid) * (1 - Math.exp(-dt * 15));
  }

  renderWarehouseTransfers(ctx: CanvasRenderingContext2D): void {
    for (const transfer of this.warehouseTransfers) {
      const progress = transfer.age / transfer.duration;
      const travel = (t: number) => {
        const eased = t * t * (3 - 2 * t);
        return {
          x: transfer.x + (WAREHOUSE_POSITION.x - transfer.x) * eased,
          y: transfer.y + (WAREHOUSE_MOUTH_Y - transfer.y) * eased - 4 * t * (1 - t) * transfer.arcHeight
        };
      };
      const position = travel(progress);

      ctx.save();
      ctx.fillStyle = '#f8d99b';
      for (let i = 1; i <= 4; i++) {
        const t = progress - .055 * i;
        if (t <= 0) break;
        const trail = travel(t);
        ctx.globalAlpha = .48 - i * .08;
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, 2.6 - i * .42, 0, Math.PI * 2);
        ctx.fill();
      }

      const arrival = Math.min(1, (1 - progress) / .22);
      const scale = (.7 + .28 * Math.sin(progress * Math.PI)) * (.45 + .55 * arrival);
      ctx.globalAlpha = arrival;
      ctx.translate(position.x, position.y);
      ctx.rotate(.45 * Math.sin(progress * Math.PI) * Math.sign(WAREHOUSE_POSITION.x - transfer.x));
      ctx.scale(scale, scale);
      drawResourceIcon(ctx, transfer.resource);
      ctx.restore();
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
    const target = player.moveTarget;
    // Alvos de coleta usam o marcador de ataque, não o anel genérico de caminhada.
    if (!target || target.autoHitNode) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(222, 187, 126, 0.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      target.x,
      target.y,
      10 + Math.sin(worldTime * 7) * 2.2,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();
  }

  renderAttackTarget(ctx: CanvasRenderingContext2D, player: PlayerState, stats: DerivedStats): void {
    const node = player.attackTarget ?? player.moveTarget?.autoHitNode;
    if (!node || node.depleted) return;

    const attacking = player.attackTarget === node && player.swingTimer > 0;
    const inReach = Math.hypot(node.x - player.x, node.y - player.y) <= stats.reachRadius + node.radius;
    const width = Math.min(24, Math.max(13, node.radius * .7));
    const height = width * .38;
    const y = node.y + 13;

    ctx.save();
    ctx.globalAlpha *= attacking ? .5 + .5 * (player.swingTimer / player.swingDuration) : inReach ? .9 : .6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(node.x, y, width, height, 0, -.62, .62);
    ctx.moveTo(node.x - width * Math.cos(.62), y + height * Math.sin(.62));
    ctx.ellipse(node.x, y, width, height, 0, Math.PI - .62, Math.PI + .62);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#54402b';
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = inReach ? '#f4d49b' : '#e5d7bb';
    ctx.stroke();
    ctx.restore();
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
