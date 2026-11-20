import { drawPlayer } from './player-sprite.ts';
import { DerivedStats, GameState, PlayerState } from '../domain/types.ts';
import { RESOURCES } from '../config/resources.ts';

export class PlayerRenderer {
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

    const bobY = Math.abs(Math.sin(player.walkCycle)) * 3;


    // Pilha física de itens nas costas da mochila!
    if (player.backpack.length > 0) {
      const maxShown = Math.min(player.backpack.length, 16);
      for (let i = 0; i < maxShown; i++) {
        const resId = player.backpack[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = -13 - col * 5;
        const by = 4 - row * 4.5 - bobY;
        ctx.fillStyle = RESOURCES[resId]?.color || '#eab308';
        ctx.fillRect(bx, by, 9, 4);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bx, by, 9, 4);
      }
    }

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
      bladeColor: tierColors[Math.min(4, state.upgrades.toolPower ?? 0)]
    });

    ctx.restore();
  }
}
