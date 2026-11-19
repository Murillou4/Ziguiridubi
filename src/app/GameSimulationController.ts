import { GameRuntimeContext } from './GameContext.ts';

/** Atualiza os sistemas de simulação na ordem de execução do jogo. */
export class GameSimulationController {
  private unloadTimer = 0;

  constructor(private readonly context: GameRuntimeContext) {}

  update(dt: number): void {
    const c = this.context;
    const clockInfo = c.clock.update(dt);
    const state = c.getState();
    const player = c.getPlayer();

    // Keep clouds animated on the title screen, during hit-stop, and during gameplay.
    c.worldSystem.updateClouds(dt);

    if (!c.getIsPlaying()) {
      c.renderer.camera.setIdlePan(c.clock.worldTime);
      return;
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
        node => c.gatheringSystem.handleHitNode(node, state, stats)
      );
    }

    // 2. Descarregamento automático perto do armazém.
    if (
      player.backpack.length > 0 &&
      Math.hypot(player.x - 95, player.y + 25) < 82
    ) {
      this.unloadTimer -= dt;
      if (this.unloadTimer <= 0) {
        this.unloadTimer = 0.06;
        const resource = c.inventorySystem.unloadOneToStorage(state, player);
        if (resource) {
          c.audio.playPickup();
          c.ui.hudView.update(state, player, stats);
        }
      }
    }

    // 3. Nós e respawn do mundo.
    c.worldSystem.update(dt, node => {
      c.renderer.effectsRenderer.addBurst(node.x, node.y, '#a7f3d0', 10);
    });

    // 4. Drops físicos e coleta magnética.
    c.gatheringSystem.updateDrops(player, stats, dt, drop => {
      c.inventorySystem.addToBackpack(player, drop.resource, stats.maxBackpack);
      c.audio.playPickup();
      c.ui.hudView.update(state, player, stats);
    });

    // 5. Expedição, produção e automação.
    c.airshipSystem.update(state, dt);
    c.machineSystem.update(state, player, stats, dt);
    c.droneSystem.update(state, stats, c.worldSystem.nodes, c.worldSystem.islands, dt);

    // 6. Efeitos e câmera.
    c.renderer.effectsRenderer.update(dt);
    c.renderer.camera.update(player.x, player.y, dt);

    // 7. Cartão contextual de inspeção.
    const targetBlueprint =
      c.buildingSystem.getNearbyBlueprint(player.x, player.y, state);

    c.ui.inspectionCard.update(
      targetBlueprint,
      state,
      player,
      c.buildingSystem,
      c.inventorySystem,
      c.renderer.camera,
      c.renderer.width,
      c.renderer.height,
      c.isModalOpen()
    );

    // 8. Atualizações periódicas da interface e autosave.
    if (clockInfo.shouldTickUI) {
      c.ui.hudView.update(state, player, stats);
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
  }
}
