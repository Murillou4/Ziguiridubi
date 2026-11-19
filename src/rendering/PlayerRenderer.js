import { RESOURCES } from '../config/resources.js';

export class PlayerRenderer {
  renderPlayer(ctx, player, state, stats) {
    ctx.save();
    ctx.translate(player.x, player.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();

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
    ctx.rotate(player.tilt);

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

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 2 - bobY, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle =
      state.specialization === 'airshipMagnate'
        ? '#0284c7'
        : state.specialization === 'automataEngineer'
        ? '#059669'
        : '#b45309';
    ctx.beginPath();
    ctx.arc(0, 1 - bobY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -9 - bobY, 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(0, -13 - bobY, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const toolAngle =
      player.swingTimer > 0
        ? player.swingAngleStart +
          (player.swingAngleEnd - player.swingAngleStart) *
            (1 - player.swingTimer / player.swingDuration)
        : player.facing + 0.55;

    ctx.save();
    ctx.rotate(toolAngle);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(8, -2, 20, 4);
    const tierColors = ['#cbd5e1', '#f59e0b', '#818cf8', '#38bdf8', '#fde047'];
    ctx.fillStyle = tierColors[Math.min(4, state.upgrades.toolPower ?? 0)];
    ctx.beginPath();
    ctx.arc(26, 0, 6, -1.1, 1.1);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}
