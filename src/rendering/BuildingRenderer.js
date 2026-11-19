import { roundRect } from './WorldRenderer.js';

export class BuildingRenderer {
  renderMerchantStall(ctx, x, y, worldTime) {
    ctx.save();
    ctx.translate(x, y);

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath();
    ctx.ellipse(0, 26, 48, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Balcão de Madeira
    ctx.fillStyle = '#78350f';
    roundRect(ctx, -38, 2, 76, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#b45309';
    roundRect(ctx, -38, -2, 76, 12, 5);
    ctx.fill();

    // Postes de sustentação
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-34, -34, 5, 36);
    ctx.fillRect(29, -34, 5, 36);

    // Toldo Listrado Dourado e Creme
    const stripes = 6;
    const sw = 84 / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#f59e0b' : '#fef3c7';
      roundRect(ctx, -42 + i * sw, -42, sw + 1, 20, 4);
      ctx.fill();
    }

    // Ícone Flutuante de Moedas acima do toldo
    const coinBob = Math.sin(worldTime * 3.5) * 4;
    ctx.font = '20px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('🪙', 0, -54 + coinBob);

    // Placa Legível no Mundo
    ctx.fillStyle = 'rgba(20, 29, 28, 0.88)';
    roundRect(ctx, -108, 34, 216, 24, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '700 10.5px Inter';
    ctx.fillStyle = '#fde68a';
    ctx.fillText('Banca do Mercador — Venda por Moedas [E]', 0, 49);

    ctx.restore();
  }

  renderWorkbenchAndWarehouse(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 24, 44, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e3a5f';
    roundRect(ctx, -36, -18, 72, 42, 10);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '22px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('🔨', 0, 9);

    ctx.fillStyle = 'rgba(20, 29, 28, 0.85)';
    roundRect(ctx, -88, 30, 176, 22, 8);
    ctx.fill();
    ctx.font = '600 10.5px Inter';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText('Armazém & Upgrades [E]', 0, 44);

    ctx.restore();
  }

  renderYellowBlueprintZone(ctx, bp, worldTime, progressPct) {
    ctx.save();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -worldTime * 22;
    roundRect(ctx, bp.x, bp.y, bp.w, bp.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    const corners = [
      [bp.x + 4, bp.y + 4],
      [bp.x + bp.w - 4, bp.y + 4],
      [bp.x + 4, bp.y + bp.h - 4],
      [bp.x + bp.w - 4, bp.y + bp.h - 4]
    ];
    corners.forEach(([cx, cy]) => {
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    const centerX = bp.x + bp.w / 2;
    const centerY = bp.y + bp.h / 2;
    ctx.font = '700 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`📐 ${bp.name}`, centerX, centerY - 2);

    if (progressPct > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(centerX - 32, centerY + 6, 64, 5);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(centerX - 32, centerY + 6, 64 * (progressPct / 100), 5);
    } else {
      ctx.font = '600 9.5px Inter';
      ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
      ctx.fillText('Aproxime-se [E]', centerX, centerY + 12);
    }

    ctx.restore();
  }

  renderBuiltStructure(ctx, bp, state, worldTime) {
    ctx.save();

    if (bp.isBridge) {
      ctx.fillStyle = '#78350f';
      roundRect(ctx, bp.x, bp.y + 6, bp.w, bp.h, 10);
      ctx.fill();
      ctx.fillStyle = '#b45309';
      roundRect(ctx, bp.x, bp.y, bp.w, bp.h, 10);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      if (bp.w > bp.h) {
        for (let px = bp.x + 14; px < bp.x + bp.w - 10; px += 18) {
          ctx.beginPath();
          ctx.moveTo(px, bp.y + 4);
          ctx.lineTo(px, bp.y + bp.h - 4);
          ctx.stroke();
        }
      } else {
        for (let py = bp.y + 14; py < bp.y + bp.h - 10; py += 18) {
          ctx.beginPath();
          ctx.moveTo(bp.x + 4, py);
          ctx.lineTo(bp.x + bp.w - 4, py);
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    const cx = bp.x + bp.w / 2;
    const cy = bp.y + bp.h / 2;

    if (bp.id === 'airshipDock') {
      ctx.fillStyle = '#78350f';
      roundRect(ctx, bp.x, bp.y, bp.w, bp.h, 14);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      const air = state.airship;
      let flyOffsetY = 0;
      let flyOffsetX = 0;
      let scale = 1;
      if (air.activeRouteId && !air.completed) {
        const t = air.elapsed / Math.max(1, air.duration);
        flyOffsetY = -Math.sin(t * Math.PI) * 140;
        flyOffsetX = Math.sin(t * Math.PI) * 95;
        scale = 1 - Math.sin(t * Math.PI) * 0.28;
      }

      ctx.save();
      ctx.translate(cx + flyOffsetX, cy - 28 + flyOffsetY + Math.sin(worldTime * 2.5) * 4);
      ctx.scale(scale, scale);

      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.ellipse(0, -18, 56, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(0, -18, 56, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#78350f';
      roundRect(ctx, -26, 12, 52, 16, 6);
      ctx.fill();

      const propH = Math.sin(worldTime * 32) * 14;
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(30, 18 - propH);
      ctx.lineTo(30, 18 + propH);
      ctx.stroke();

      ctx.restore();

      ctx.font = '700 11px Inter';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef3c7';
      ctx.fillText('🎈 Cais do Dirigível [E]', cx, bp.y + bp.h + 15);
      ctx.restore();
      return;
    }

    const colors = {
      sawmill: '#b45309',
      furnace: '#dc2626',
      gearWorkshop: '#d97706',
      droneStation: '#0284c7'
    };
    const icons = {
      sawmill: '🪚',
      furnace: '🔥',
      gearWorkshop: '⚙️',
      droneStation: '🤖'
    };

    ctx.fillStyle = '#1c1917';
    roundRect(ctx, bp.x, bp.y, bp.w, bp.h, 14);
    ctx.fill();
    ctx.fillStyle = colors[bp.id] || '#475569';
    roundRect(ctx, bp.x + 4, bp.y + 4, bp.w - 8, bp.h - 10, 11);
    ctx.fill();

    ctx.font = '24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[bp.id] || '⚙️', cx, cy - 2);

    ctx.font = '600 10.5px Inter';
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(bp.name, cx, bp.y + bp.h + 13);

    const mach = state.machines[bp.id];
    if (mach && mach.progress > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bp.x + 12, bp.y - 9, bp.w - 24, 5);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(bp.x + 12, bp.y - 9, (bp.w - 24) * mach.progress, 5);
    }

    ctx.restore();
  }
}
