import { buildRock, drawRock } from './world-rocks.ts';
import { drawBigTree, drawSmallTree } from './world-trees.ts';
import { DerivedStats, GameState, IslandDef, ResourceNode } from '../domain/types.ts';

export class ResourceRenderer {
  private readonly rocks = new WeakMap<ResourceNode, ReturnType<typeof buildRock>>();

  renderNodes(
    ctx: CanvasRenderingContext2D,
    nodes: ResourceNode[],
    islands: IslandDef[],
    state: GameState,
    stats: DerivedStats,
    worldTime: number,
    player: { x: number; y: number }
  ): void {
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

      if (n.type !== 'tree' && n.type !== 'rock') {
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(0, 14, n.radius * 0.9, n.radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (n.type === 'tree') {
        const small = Math.abs(Math.round(n.x * 3 + n.y)) % 3 === 0;
        const drawTree = small ? drawSmallTree : drawBigTree;
        const distance = Math.hypot(n.x - player.x, n.y - player.y);
        drawTree(ctx, 0, 16, {
          time: worldTime + n.x * 0.013,
          fruitSeed: Math.imul(Math.round(n.x * 100), 73856093) ^ Math.imul(Math.round(n.y * 100), 19349663),
          near: Math.max(0, 1 - distance / (stats.reachRadius + n.radius)),
          active: n.hitAnim
        });
      } else if (n.type === 'rock') {
        let rock = this.rocks.get(n);
        if (!rock) {
          const seed = Math.round(n.x * 19 + n.y * 47);
          rock = buildRock(seed, n.radius * 2);
          this.rocks.set(n, rock);
        }
        const damageStage = Math.min(3, Math.floor((1 - n.hp / n.maxHp) * 4));
        drawRock(ctx, rock, 0, 10, damageStage, n.hitAnim);
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

      // Barra de vida se danificado
      if (n.hp < n.maxHp) {
        const bw = 34;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(-bw / 2, 22, bw, 5);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-bw / 2, 22, bw * (n.hp / n.maxHp), 5);
      }

      // Anel Rítmico de Sweet Spot
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
