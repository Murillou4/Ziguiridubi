import { ResourceNode } from '../domain/types.ts';
import type { TutorialCue } from '../domain/Tutorial.ts';
import { getNearbyStation } from '../config/buildings.ts';
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

  triggerSwing(target?: ResourceNode): void {
    const c = this.context;
    if (!c.getIsPlaying() || c.isModalOpen()) return;

    c.audio.init();
    const state = c.getState();
    const player = c.getPlayer();
    const stats = c.getStats();

    if (!c.playerSystem.triggerSwing(player, stats)) return;

    c.audio.playSwing();
    let bestTargetScore = Infinity;
    let bestTarget: ResourceNode | null = null;

    c.worldSystem.nodes.forEach(node => {
      if (node.depleted || (target && node.type !== target.type)) return;
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
        const score = node === target ? -1 : distance + Math.abs(difference) * stats.reachRadius;
        if (score < bestTargetScore) {
          bestTargetScore = score;
          bestTarget = node;
          player.heldTool = node.type === 'tree' ? 'axe' : 'pickaxe';
        }
        c.gatheringSystem.handleHitNode(node, state, stats);
      }
    });
    player.attackTarget = bestTarget;
  }

  triggerContextInteract(): void {
    const c = this.context;
    if (!c.getIsPlaying() || c.isModalOpen()) return;

    const state = c.getState();
    const player = c.getPlayer();

    const nearbyBlueprint = c.buildingSystem.getNearbyBlueprint(player.x, player.y, state);
    if (nearbyBlueprint) {
      if (c.ui.inspectionCard.activeInspectedZone?.id === nearbyBlueprint.id) {
        c.buildingSystem.interactWithBlueprint(nearbyBlueprint.id, state, player);
      } else {
        c.ui.inspectionCard.open(nearbyBlueprint);
      }
      return;
    }

    const station = getNearbyStation(player.x, player.y, state);
    if (station) {
      c.ui.openModal(station.modal, () => c.getState(), () => c.getPlayer(), () => c.getStats());
    }
  }

  handleCanvasClick(tutorial: TutorialCue | null = null): void {
    const c = this.context;
    if (!c.getIsPlaying() || c.isModalOpen()) return;

    c.audio.init();
    c.input.updateWorldMouse(
      c.renderer.camera,
      c.renderer.width,
      c.renderer.height
    );

    const player = c.getPlayer();
    const state = c.getState();
    const mouse = c.input.mouse;
    const clickedMarker = tutorial && Math.hypot(mouse.worldX - tutorial.x, mouse.worldY - tutorial.y + tutorial.lift) < 20 / c.renderer.camera.zoom;
    const x = clickedMarker ? tutorial.x : mouse.worldX;
    const y = clickedMarker ? tutorial.y : mouse.worldY;
    player.facing = Math.atan2(y - player.y, x - player.x);

    const action = tutorial?.action;
    const guidingMovement = action === 'walk' || action === 'pickup' || action === 'approach' || action === 'unload';
    if (tutorial && guidingMovement && Math.hypot(x - tutorial.x, y - tutorial.y) < 30 &&
        c.worldSystem.isPointWalkable(state, tutorial.x, tutorial.y)) {
      player.moveTarget = { x: tutorial.x, y: tutorial.y };
      return;
    }
    if (action === 'inspect' || action === 'deposit') {
      const blueprint = c.buildingSystem.getNearbyBlueprint(player.x, player.y, state);
      if (blueprint?.id === 'sawmill' && x >= blueprint.x - 8 && x <= blueprint.x + blueprint.w + 8 &&
          y >= blueprint.y - 22 && y <= blueprint.y + blueprint.h + 8) {
        this.triggerContextInteract();
        return;
      }
    }

    const stats = c.getStats();
    let clickedNode: ResourceNode | undefined;
    let bestClickScore = Infinity;
    for (const node of c.worldSystem.nodes) {
      const distance = Math.hypot(node.x - x, node.y - y);
      if (node.depleted || distance > node.radius + 26) continue;

      // Clique no corpo do recurso tem prioridade sobre a margem de seleção.
      const score = distance <= node.radius ? distance / node.radius : 1 + (distance - node.radius) / 26;
      if (score < bestClickScore) {
        clickedNode = node;
        bestClickScore = score;
      }
    }

    if (clickedNode) {
      const distance = Math.hypot(clickedNode.x - player.x, clickedNode.y - player.y);
      if (distance <= stats.reachRadius + clickedNode.radius) {
        player.moveTarget = null;
        player.facing = Math.atan2(clickedNode.y - player.y, clickedNode.x - player.x);
        this.triggerSwing(clickedNode);
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
      Math.hypot(x + 95, y + 25) < 58 &&
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

    if (hasNodeInRange && !tutorial) {
      player.moveTarget = null;
      this.triggerSwing();
    } else if (c.worldSystem.isPointWalkable(state, x, y)) {
      player.moveTarget = { x, y };
    } else {
      this.triggerSwing();
    }
  }

  updateHoveredBlueprint(): void {
    // Build prompts are proximity-based. Cursor movement cannot trigger them.
    this.context.setHoveredBlueprint(null);
  }
}
