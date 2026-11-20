import { GameState, IslandDef } from '../domain/types.ts';
import { Cloud } from '../gameplay/WorldSystem.ts';

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class WorldRenderer {
  renderSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#193547');
    bgGrad.addColorStop(0.5, '#234a60');
    bgGrad.addColorStop(1, '#183344');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
  }

  renderClouds(ctx: CanvasRenderingContext2D, clouds: Cloud[]): void {
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

  renderIslands(ctx: CanvasRenderingContext2D, islands: IslandDef[], state: GameState): void {
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
        // Praça de terra batida, com borda irregular e pedras discretas.
        ctx.fillStyle = '#668b59';
        ctx.beginPath();
        ctx.ellipse(0, 8, 190, 130, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b4a477';
        ctx.beginPath();
        ctx.ellipse(0, 4, 178, 117, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c7b78a';
        ctx.beginPath();
        ctx.ellipse(0, -1, 168, 106, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lajes e pequenas marcas criam textura sem obstruir a circulação.
        const stones = [[-145, -34, 15, 8], [-121, 43, 18, 9], [-70, 69, 14, 7],
          [-22, 79, 19, 9], [35, 74, 15, 7], [93, 60, 20, 9],
          [139, 23, 14, 8], [129, -65, 16, 8], [55, -83, 17, 7],
          [-26, -81, 14, 7], [-105, -67, 17, 8]];
        for (const [sx, sy, rx, ry] of stones) {
          ctx.fillStyle = 'rgba(101, 91, 67, 0.19)';
          ctx.beginPath(); ctx.ellipse(sx + 1, sy + 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(237, 220, 175, 0.52)';
          ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(102, 83, 54, 0.25)';
        for (const [dx, dy] of [[-153, 4], [-80, -91], [8, 97], [75, -65], [150, 53], [-57, 45], [45, 39]]) {
          ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI * 2); ctx.fill();
        }
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
