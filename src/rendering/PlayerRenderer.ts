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

    // Arco de golpe
    if (player.swingTimer > 0) {
      const progress = 1 - player.swingTimer / player.swingDuration;
      ctx.save();
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
      ctx.fillStyle = 'rgba(254, 240, 138, 0.14)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(
        0,
        0,
        stats.reachRadius * 0.85,
        player.swingAngleStart,
        player.swingAngleStart + (player.swingAngleEnd - player.swingAngleStart) * progress
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
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
