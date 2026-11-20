import { DerivedStats, DropItem, GameState, PlayerState } from '../domain/types.ts';
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

const ATTACK_GUIDE_DASH = [3, 6];
const ATTACK_RING_DASH = [4, 6];

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

  /** Prévia visual do golpe enquanto o jogador se aproxima de um recurso selecionado. */
  renderAttackTarget(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    stats: DerivedStats,
    worldTime: number
  ): void {
    const node = player.attackTarget ?? player.moveTarget?.autoHitNode;
    if (!node || (node.depleted && node !== player.attackTarget)) return;

    const dx = node.x - player.x;
    const dy = node.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;

    const angle = Math.atan2(dy, dx);
    const halfArc = stats.swingArc * 0.72;
    const startAngle = angle - halfArc;
    const endAngle = angle + halfArc;
    const sectorRadius = Math.min(
      stats.reachRadius + node.radius,
      distance + node.radius * 0.4
    );
    const ringRadius = Math.max(34, node.radius + 18);
    const pulse = 0.5 + 0.5 * Math.sin(worldTime * 4.2);

    ctx.save();

    // Leque de alcance: usa o mesmo arco e raio considerados pelo acerto do golpe.
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(player.x, player.y, sectorRadius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(204, 158, 91, 0.13)';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(69, 50, 34, 0.38)';
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(224, 181, 116, 0.78)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Linha central discreta para deixar a direção do ataque inequívoca.
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(node.x, node.y);
    ctx.setLineDash(ATTACK_GUIDE_DASH);
    ctx.lineDashOffset = -worldTime * 7;
    ctx.strokeStyle = 'rgba(249, 229, 194, 0.62)';
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.setLineDash([]);

    // Halo e anel marfim enquadram o recurso sem esconder sua silhueta.
    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius + 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(214, 174, 116, ${0.035 + pulse * 0.025})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(71, 53, 37, 0.42)';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius + 4, 0, Math.PI * 2);
    ctx.setLineDash(ATTACK_RING_DASH);
    ctx.lineDashOffset = -worldTime * 3.2;
    ctx.strokeStyle = `rgba(207, 164, 105, ${0.55 + pulse * 0.16})`;
    ctx.lineWidth = 1.15;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(65, 51, 37, 0.68)';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(248, 242, 226, ${0.88 + pulse * 0.1})`;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Pequenas marcas de latão dão acabamento de peça artesanal ao círculo.
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const tickAngle = i * Math.PI * 0.5;
      const inner = ringRadius - 3;
      const outer = ringRadius + 2;
      ctx.moveTo(node.x + Math.cos(tickAngle) * inner, node.y + Math.sin(tickAngle) * inner);
      ctx.lineTo(node.x + Math.cos(tickAngle) * outer, node.y + Math.sin(tickAngle) * outer);
    }
    ctx.strokeStyle = 'rgba(213, 169, 105, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Seta presa à borda próxima do jogador e apontada para o centro do alvo.
    const arrowX = node.x - Math.cos(angle) * (ringRadius + 5);
    const arrowY = node.y - Math.sin(angle) * (ringRadius + 5);
    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -6.2);
    ctx.lineTo(-3.2, 0);
    ctx.lineTo(-6, 6.2);
    ctx.closePath();
    ctx.fillStyle = '#d7a75f';
    ctx.strokeStyle = '#503927';
    ctx.lineWidth = 2.1;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-2.5, 0);
    ctx.lineTo(5.7, 0);
    ctx.strokeStyle = 'rgba(255, 239, 204, 0.9)';
    ctx.lineWidth = 1.15;
    ctx.stroke();
    ctx.restore();

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
