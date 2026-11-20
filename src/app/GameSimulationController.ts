import { GameRuntimeContext } from './GameContext.ts';
import { PlayerInteractionController } from './PlayerInteractionController.ts';
import { WAREHOUSE_POSITION } from '../config/buildings.ts';

/** Atualiza os sistemas de simulação na ordem de execução do jogo. */
export class GameSimulationController {
  private unloadTimer = 0;

  constructor(
    private readonly context: GameRuntimeContext,
    private readonly interactions = new PlayerInteractionController(context)
  ) {}

  update(dt: number, isCatchingUp: boolean = false): void {
    const c = this.context;
    const clockInfo = c.clock.update(dt);
    const state = c.getState();
    const player = c.getPlayer();

    // Keep clouds animated on the title screen, during hit-stop, and during gameplay.
    c.worldSystem.updateClouds(dt);

    if (!c.getIsPlaying()) {
      c.renderer.camera.setIdlePan(c.clock.worldTime, c.renderer.width, c.renderer.height);
      return;
    }

    if (c.audio?.update) {
      c.audio.update(dt, c.clock.realTime, isCatchingUp);
    } else {
      c.audio?.updateWeather?.(c.clock.realTime.weather);
    }

    if (clockInfo.isHitStopped) return;

    const stats = c.getStats();

    // 1. Movimentação do jogador.
    if (!c.isModalOpen()) {
      const inputState = c.input.getPlayerInput();
      c.playerSystem.update(
        player,
        state,
        stats,
        dt,
        inputState,
        (currentState, x, y) => c.worldSystem.isPointWalkable(currentState, x, y),
        node => {
          if (!isCatchingUp) this.interactions.triggerSwing(node);
        }
      );
    }

    // 2. Descarregamento automático perto do armazém.
    if (
      player.backpack.length > 0 &&
      Math.hypot(player.x - WAREHOUSE_POSITION.x, player.y - WAREHOUSE_POSITION.y) < 82
    ) {
      this.unloadTimer -= dt;
      if (this.unloadTimer <= 0) {
        this.unloadTimer = 0.06;
        const resource = c.inventorySystem.unloadOneToStorage(state, player);
        if (resource && !isCatchingUp) {
          c.renderer.effectsRenderer.addWarehouseTransfer(resource, player);
          c.ui.hudView.update(state, player, stats);
        }
      }
    }

    // 3. Nós e respawn do mundo.
    c.worldSystem.update(dt, node => {
      if (!isCatchingUp) {
        c.renderer.effectsRenderer.addBurst(node.x, node.y, '#a7f3d0', 10);
      }
    });

    // 4. Drops físicos e coleta magnética.
    c.gatheringSystem.updateDrops(player, stats, dt, (x, y) => c.worldSystem.isPointWalkable(state, x, y), drop => {
      if (!c.inventorySystem.addToBackpack(player, drop.resource, stats.maxBackpack)) return;
      c.eventBus.emit('gathering:pickedUp', drop);
      if (!isCatchingUp) c.audio.playPickup();
      if (!isCatchingUp) c.ui.hudView.update(state, player, stats);
    });

    // 5. Expedição, produção e automação.
    c.airshipSystem.update(state, dt);
    c.machineSystem.update(state, player, stats, dt);
    c.droneSystem.update(state, stats, c.worldSystem.nodes, c.worldSystem.islands, dt);

    // 6. Efeitos e câmera.
    if (!isCatchingUp) {
      c.renderer.effectsRenderer.update(dt, resource => {
        c.audio.playPickup();
        c.ui.hudView.animateWarehouseReceipt(resource);
      });
      c.renderer.camera.update(player.x, player.y, dt);
    }

    // 7. Cartão contextual de inspeção.
    if (!isCatchingUp) {
      const nearbyBlueprint = c.buildingSystem.getNearbyBlueprint(player.x, player.y, state);
      const selectedBlueprint = c.ui.inspectionCard.activeInspectedZone;
      const targetBlueprint = selectedBlueprint?.id === nearbyBlueprint?.id ? selectedBlueprint : null;

      c.ui.inspectionCard.update(
        targetBlueprint,
        state,
        player,
        c.buildingSystem,
        c.inventorySystem,
        c.renderer.camera,
        c.renderer.width,
        c.renderer.height,
        c.isModalOpen(),
        c.input.mode
      );
    }

    // 8. Atualizações periódicas da interface e autosave.
    if (clockInfo.shouldTickUI && !isCatchingUp) {
      c.ui.hudView.update(state, player, stats);
      c.ui.refreshActiveModalResources?.(state, player, stats);
      if (c.ui.activeModal === 'modalAirship' && state.airship.activeRouteId) {
        c.ui.airshipModal.render(state, player, stats);
      }
    }

    if (clockInfo.shouldAutoSave) {
      c.saveService.save(state, player, c.audio.settings, true);
    }
  }

  resetTimers(): void {
    this.unloadTimer = 0;
    this.context.renderer?.effectsRenderer.clearWarehouseTransfers();
  }
}
