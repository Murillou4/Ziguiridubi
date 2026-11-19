export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class WorldRenderer {
  renderSky(ctx, w, h) {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#193547');
    bgGrad.addColorStop(0.5, '#234a60');
    bgGrad.addColorStop(1, '#183344');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
  }

  renderClouds(ctx, clouds) {
    clouds.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.fillStyle = `rgba(224, 242, 254, ${c.alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.arc(42, -8, 38, 0, Math.PI * 2);
      ctx.arc(-40, 5, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  renderIslands(ctx, islands, state) {
    islands.forEach(isl => {
      const unlocked = isl.unlocked(state);
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.45;
      const left = isl.x - isl.w / 2;
      const top = isl.y - isl.h / 2;

      ctx.fillStyle = isl.cliffColor;
      roundRect(ctx, left + 8, top + 28, isl.w - 16, isl.h, 38);
      ctx.fill();

      ctx.fillStyle = isl.edgeColor;
      roundRect(ctx, left, top + 8, isl.w, isl.h, 38);
      ctx.fill();

      ctx.fillStyle = isl.topColor;
      roundRect(ctx, left, top, isl.w, isl.h, 38);
      ctx.fill();

      if (isl.id === 'hub') {
        ctx.fillStyle = 'rgba(235, 218, 185, 0.34)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 175, 115, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!unlocked) {
        const badgeY = isl.id === 'north_dock' ? isl.y + 72 : isl.y;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        roundRect(ctx, isl.x - 115, badgeY - 20, 230, 40, 12);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.font = '600 12.5px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`🔒 ${isl.name}`, isl.x, badgeY + 4);
      }
      ctx.restore();
    });
  }
}
