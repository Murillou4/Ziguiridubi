import { BlueprintConfig } from '../config/buildings.ts';
import { GameRuntimeContext } from './GameContext.ts';

/**
 * Converte intenções de teclado, mouse e touch em ações do jogo.
 * Não registra listeners: recebe os comandos já normalizados pelo InputManager.
 */
export class PlayerInteractionController {
  constructor(private readonly context: GameRuntimeContext) {}

  triggerDash(): void {
    const c = this.context;
    if (!c.getIsPlaying() || c.isModalOpen()) return;

    c.audio.init();
    const player = c.getPlayer();
    const state = c.getState();
    const stats = c.getStats();
    const input = c.input.getPlayerInput();
    const dashed = c.playerSystem.triggerDash(player, stats, {
      dx: input.ix,
      dy: input.iy
    });

    if (!dashed) return;

    c.audio.playDash();
    c.renderer.camera.addShake(4);

    if ((state.upgrades.steamDash ?? 0) > 0) {
      c.worldSystem.nodes.forEach(node => {
        if (
          !node.depleted &&
          node.reqPower <= stats.toolPower &&
          Math.hypot(node.x - player.x, node.y - player.y) < 105
        ) {
          c.gatheringSystem.damageNode(node, 1, false, state, stats);
        }
      });
    }

    for (let i = 0; i < 12; i++) {
      c.renderer.effectsRenderer.particles.push({
        x: player.x,
        y: player.y,
        vx: -player.dashDirX * (60 + Math.random() * 80) + (Math.random() - 0.5) * 60,
        vy: -player.dashDirY * (60 + Math.random() * 80) + (Math.random() - 0.5) * 60,
        size: 3 + Math.random() * 4,
        color: '#fde047',
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  triggerSwing(): void {
    const c = this.context;
    if (!c.getIsPlaying() || c.isModalOpen()) return;

    c.audio.init();
    const state = c.getState();
    const player = c.getPlayer();
    const stats = c.getStats();

    if (!c.playerSystem.triggerSwing(player, stats)) return;

    c.audio.playSwing();
    let hitAny = false;

    c.worldSystem.nodes.forEach(node => {
      if (node.depleted) return;
      const island = c.worldSystem.islands.find(item => item.id === node.islandId);
      if (island && !island.unlocked(state)) return;

      const dx = node.x - player.x;
      const dy = node.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance > stats.reachRadius + node.radius) return;

      const angleToNode = Math.atan2(dy, dx);
      let difference = angleToNode - player.facing;
      while (difference > Math.PI) difference -= Math.PI * 2;
      while (difference < -Math.PI) difference += Math.PI * 2;

      if (Math.abs(difference) <= stats.swingArc * 0.72 || distance < 48) {
        hitAny = true;
        c.gatheringSystem.handleHitNode(node, state, stats);
      }
    });

    if (hitAny) c.renderer.camera.addShake(3.5);
  }

  triggerContextInteract(): void {
    const c = this.context;
    if (!c.getIsPlaying() || c.isModalOpen()) return;

    const state = c.getState();
    const player = c.getPlayer();

    const nearbyBlueprint = c.buildingSystem.getNearbyBlueprint(player.x, player.y, state);
    if (nearbyBlueprint) {
      c.buildingSystem.interactWithBlueprint(nearbyBlueprint.id, state, player);
      return;
    }

    if (Math.hypot(player.x + 95, player.y + 25) < 95) {
      c.ui.openModal('modalMerchant', () => c.getState(), () => c.getPlayer(), () => c.getStats());
      return;
    }

    if (Math.hypot(player.x - 95, player.y + 25) < 95) {
      c.ui.openModal('modalWorkshop', () => c.getState(), () => c.getPlayer(), () => c.getStats());
      return;
    }

    if (
      state.builds.airshipDock?.built &&
      Math.hypot(player.x, player.y + 616) < 135
    ) {
      c.ui.openModal('modalAirship', () => c.getState(), () => c.getPlayer(), () => c.getStats());
    }
  }

  handleCanvasClick(): void {
    const c = this.context;
    if (!c.getIsPlaying() || c.isModalOpen()) return;

    c.audio.init();
    c.input.updateWorldMouse(
      c.renderer.camera.x,
      c.renderer.camera.y,
      c.renderer.width,
      c.renderer.height
    );

    const player = c.getPlayer();
    const state = c.getState();
    const mouse = c.input.mouse;
    player.facing = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);

    const stats = c.getStats();
    const clickedNode = c.worldSystem.nodes.find(
      node =>
        !node.depleted &&
        Math.hypot(node.x - mouse.worldX, node.y - mouse.worldY) <= node.radius + 26
    );

    if (clickedNode) {
      const distance = Math.hypot(clickedNode.x - player.x, clickedNode.y - player.y);
      if (distance <= stats.reachRadius + clickedNode.radius) {
        player.moveTarget = null;
        this.triggerSwing();
      } else {
        player.moveTarget = {
          x: clickedNode.x,
          y: clickedNode.y,
          autoHitNode: clickedNode
        };
      }
      return;
    }

    if (
      Math.hypot(mouse.worldX + 95, mouse.worldY + 25) < 58 &&
      Math.hypot(player.x + 95, player.y + 25) < 115
    ) {
      c.ui.openModal('modalMerchant', () => c.getState(), () => c.getPlayer(), () => c.getStats());
      return;
    }

    const hasNodeInRange = c.worldSystem.nodes.some(
      node =>
        !node.depleted &&
        Math.hypot(node.x - player.x, node.y - player.y) <= stats.reachRadius + node.radius
    );

    if (hasNodeInRange) {
      player.moveTarget = null;
      this.triggerSwing();
    } else if (c.worldSystem.isPointWalkable(state, mouse.worldX, mouse.worldY)) {
      player.moveTarget = { x: mouse.worldX, y: mouse.worldY };
    } else {
      this.triggerSwing();
    }
  }

  updateHoveredBlueprint(): void {
    // Build prompts are proximity-based. Cursor movement cannot trigger them.
    this.context.setHoveredBlueprint(null);
  }
}
