export class ResourceRenderer {
  renderNodes(ctx, nodes, islands, state, stats, worldTime) {
    nodes.forEach(n => {
      if (n.depleted) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      const isl = islands.find(i => i.id === n.islandId);
      if (isl && !isl.unlocked(state)) return;

      ctx.save();
      const shake = n.hitAnim > 0 ? Math.sin(n.hitAnim * 28) * 4 * n.hitAnim : 0;
      ctx.translate(n.x + shake, n.y);

      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath();
      ctx.ellipse(0, 14, n.radius * 0.9, n.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      if (n.type === 'tree') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-6, -4, 12, 18);
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(0, -14, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(-4, -18, 17, 0, Math.PI * 2);
        ctx.fill();
      } else if (n.type === 'rock') {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(-5, -5, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (n.type === 'iron') {
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(-7, -5, 8, 0, Math.PI * 2);
        ctx.arc(8, 3, 7, 0, Math.PI * 2);
        ctx.arc(0, -10, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (n.type === 'ether') {
        const fy = Math.sin(worldTime * 3.5 + n.x) * 4;
        ctx.fillStyle = '#4f46e5';
        ctx.beginPath();
        ctx.moveTo(0, -28 + fy);
        ctx.lineTo(19, fy);
        ctx.lineTo(0, 22 + fy);
        ctx.lineTo(-19, fy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#a5b4fc';
        ctx.beginPath();
        ctx.arc(0, fy, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (n.hp < n.maxHp) {
        const bw = 34;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(-bw / 2, 22, bw, 5);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-bw / 2, 22, bw * (n.hp / n.maxHp), 5);
      }

      if (n.sweetSpotTimer > 0) {
        const progress = n.sweetSpotTimer / n.sweetSpotDuration;
        const inZone = progress >= 0.10 && progress <= 0.10 + stats.sweetSpotWindow;
        const targetR = 20;
        const currentR = targetR + progress * 44;

        ctx.strokeStyle = inZone ? '#fde047' : 'rgba(253, 224, 71, 0.48)';
        ctx.lineWidth = inZone ? 4 : 2;
        ctx.beginPath();
        ctx.arc(0, -4, targetR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = inZone ? '#4ade80' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -4, currentR, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });
  }
}
