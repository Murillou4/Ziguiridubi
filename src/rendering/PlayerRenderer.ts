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

    // Um traço curto acompanha a ferramenta durante o golpe.
    if (player.swingTimer > 0) {
      const progress = 1 - player.swingTimer / player.swingDuration;
      const tipAngle = player.swingAngleStart + (player.swingAngleEnd - player.swingAngleStart) * progress;
      const tailAngle = Math.max(player.swingAngleStart, tipAngle - .85);
      const radius = Math.min(33, stats.reachRadius * .72);
      ctx.save();
      ctx.globalAlpha *= Math.sin(progress * Math.PI) * .82;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, -9, radius, tailAngle, tipAngle);
      ctx.strokeStyle = '#684832';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = '#f4d6a1';
      ctx.lineWidth = 2;
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
    drawPlayer(ctx, 0, 14, {
      facing,
      time: worldTime,
      moving: Math.hypot(player.vx, player.vy) > 1 || player.dashTimer > 0,
      swing: player.swingTimer > 0 ? Math.max(0.001, 1 - player.swingTimer / player.swingDuration) : 0,
      tool: player.heldTool,
      appearance: player.appearance,
      packFill: this.packFill,
      packOpen: this.packOpen,
      cargo: player.backpack,
      toolLevel: state.upgrades.toolPower
    });

    ctx.restore();
  }
}
