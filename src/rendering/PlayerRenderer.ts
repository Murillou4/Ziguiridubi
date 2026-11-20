import { drawPlayer } from './player-sprite.ts';
import { DerivedStats, GameState, PlayerState } from '../domain/types.ts';

export class PlayerRenderer {
  private packFill = 0;
  private packOpen = 0;
  private lastRenderTime?: number;

  renderPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    state: GameState,
    stats: DerivedStats,
    worldTime: number
  ): void {
    ctx.save();
    ctx.translate(player.x, player.y);

    // Rastro do golpe: latão translúcido com contorno escuro, no mesmo acabamento do alvo.
    if (player.swingTimer > 0) {
      const progress = 1 - player.swingTimer / player.swingDuration;
      const sweepEnd = player.swingAngleStart + (player.swingAngleEnd - player.swingAngleStart) * progress;
      const sweepRadius = stats.reachRadius * 0.85;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, sweepRadius, player.swingAngleStart, sweepEnd);
      ctx.closePath();
      ctx.fillStyle = 'rgba(204, 158, 91, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(69, 50, 34, 0.52)';
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(247, 222, 180, 0.9)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Ponto de luz marca a extremidade atual do movimento da ferramenta.
      ctx.beginPath();
      ctx.arc(Math.cos(sweepEnd) * sweepRadius, Math.sin(sweepEnd) * sweepRadius, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = '#f2d49a';
      ctx.fill();
      ctx.restore();
    }

    const targetFill = Math.min(1, player.backpack.length / stats.maxBackpack);
    const targetOpen = targetFill === 1 ? 1 : 0;
    const dt = worldTime - (this.lastRenderTime ?? worldTime);
    const blend = this.lastRenderTime === undefined || dt < 0
      ? 1
      : 1 - Math.exp(-Math.min(dt, 0.1) * 14);
    this.packFill += (targetFill - this.packFill) * blend;
    this.packOpen += (targetOpen - this.packOpen) * blend;
    this.lastRenderTime = worldTime;

    const horizontal = Math.cos(player.facing);
    const vertical = Math.sin(player.facing);
    const facing = Math.abs(horizontal) > Math.abs(vertical)
      ? horizontal > 0 ? 'right' : 'left'
      : vertical > 0 ? 'down' : 'up';
    const tierColors = ['#cbd5e1', '#f59e0b', '#818cf8', '#38bdf8', '#fde047'];

    drawPlayer(ctx, 0, 14, {
      facing,
      time: worldTime,
      moving: Math.hypot(player.vx, player.vy) > 1 || player.dashTimer > 0,
      swing: player.swingTimer > 0 ? Math.max(0.001, 1 - player.swingTimer / player.swingDuration) : 0,
      tool: player.heldTool,
      packFill: this.packFill,
      packOpen: this.packOpen,
      cargo: player.backpack,
      bladeColor: tierColors[Math.min(4, state.upgrades.toolPower ?? 0)]
    });

    ctx.restore();
  }
}
