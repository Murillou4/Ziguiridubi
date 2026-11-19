import { DerivedStats, GameState, PlayerState, SavePayload } from '../domain/types.ts';
import { createDefaultState } from '../domain/GameState.ts';
import { createDefaultPlayer } from '../domain/PlayerState.ts';
import { getDerivedStats } from '../domain/Stats.ts';
import { GameClock } from '../core/GameClock.ts';
import { GameLoop } from '../core/GameLoop.ts';
import { BlueprintConfig } from '../config/buildings.ts';
import { GameAppServices, GameRuntimeContext } from './GameContext.ts';
import { GameSimulationController } from './GameSimulationController.ts';
import { PlayerInteractionController } from './PlayerInteractionController.ts';

/**
 * Composição e ciclo de vida da partida.
 * Regras de interação e atualização por frame pertencem aos controladores dedicados.
 */
export class GameApp {
  public isPlaying = false;
  public state: GameState;
  public player: PlayerState;
  public clock: GameClock;
  public loop: GameLoop;
  public hoveredBlueprint: BlueprintConfig | null = null;

  public readonly services: GameAppServices;
  public readonly simulation: GameSimulationController;
  public readonly interactions: PlayerInteractionController;

  constructor(services: GameAppServices) {
    this.services = services;
    this.state = createDefaultState();
    this.player = createDefaultPlayer();
    this.clock = new GameClock();

    const context: GameRuntimeContext = {
      ...services,
      clock: this.clock,
      getState: () => this.state,
      setState: state => { this.state = state; },
      getPlayer: () => this.player,
      setPlayer: player => { this.player = player; },
      getIsPlaying: () => this.isPlaying,
      setIsPlaying: value => { this.isPlaying = value; },
      isModalOpen: () => Boolean(this.services.ui.activeModal),
      getHoveredBlueprint: () => this.hoveredBlueprint,
      setHoveredBlueprint: blueprint => { this.hoveredBlueprint = blueprint; },
      getStats: () => this.getStats()
    };

    this.simulation = new GameSimulationController(context);
    this.interactions = new PlayerInteractionController(context);

    this.loop = new GameLoop(
      dt => this.simulation.update(dt),
      () => this.render()
    );

    this.bindAppEvents();
  }

  getStats(): DerivedStats {
    return getDerivedStats(this.state);
  }

  private bindAppEvents(): void {
    const { eventBus, input, renderer, saveService, audio, droneSystem } = this.services;

    eventBus.on('input:dash', () => this.interactions.triggerDash());
    eventBus.on('input:swing', () => this.interactions.triggerSwing());
    eventBus.on('input:interact', () => this.interactions.triggerContextInteract());

    eventBus.on('input:mouseMove', () => {
      input.updateWorldMouse(
        renderer.camera.x,
        renderer.camera.y,
        renderer.width,
        renderer.height
      );
      this.interactions.updateHoveredBlueprint();
    });

    eventBus.on('input:canvasClick', () => this.interactions.handleCanvasClick());

    eventBus.on('upgrade:purchased', (data: { id?: string }) => {
      if (data?.id === 'lumberDrone' || data?.id === 'minerDrone') {
        droneSystem.syncDrones(this.state);
      }
    });

    eventBus.on('fx:shake', (data: { magnitude?: number }) => {
      renderer.camera.addShake(data?.magnitude || 4);
    });

    eventBus.on('fx:burst', (data: { x: number; y: number; color: string; count?: number }) => {
      renderer.effectsRenderer.addBurst(data.x, data.y, data.color, data.count || 10);
    });

    eventBus.on('fx:floatingText', (data: { x: number; y: number; text: string; color?: string }) => {
      renderer.effectsRenderer.addFloatingText(data.x, data.y, data.text, data.color || '#fef3c7');
    });

    eventBus.on('game:hitstop', (data: { duration?: number }) => {
      this.clock.addHitStop(data?.duration || 0.032);
    });

    eventBus.on('save:request', (data: { silent?: boolean }) => {
      saveService.save(this.state, this.player, audio.settings, data?.silent ?? true);
    });

    window.addEventListener('resize', () => renderer.resize());
  }

  init(): void {
    const {
      input,
      renderer,
      audio,
      saveService,
      ui,
      contractSystem,
      droneSystem
    } = this.services;

    if (!this.state.contracts || this.state.contracts.length === 0) {
      this.state.contracts = contractSystem.generateContracts(this.state.phase);
    }

    const saved = saveService.load();
    if (saved) {
      this.applySavePayload(saved);
      const startLabel = document.getElementById('btnStartLabel');
      if (startLabel) startLabel.textContent = 'Continuar Jornada';
    }

    input.init(renderer.canvas);
    droneSystem.syncDrones(this.state);

    ui.init(
      () => this.state,
      () => this.player,
      () => this.getStats(),
      () => {
        audio.init();
        audio.playUpgrade();
        this.isPlaying = true;
        ui.refreshAll(() => this.state, () => this.player, () => this.getStats());
      },
      () => this.resetGame(),
      payload => this.applySavePayload(payload)
    );

    ui.refreshAll(() => this.state, () => this.player, () => this.getStats());
    this.loop.start();
  }

  applySavePayload(payload: SavePayload): void {
    const { audio, droneSystem, saveService, ui, gatheringSystem } = this.services;

    this.state = payload.state;
    this.player.x = payload.playerPos.x;
    this.player.y = payload.playerPos.y;
    this.player.backpack = [];
    gatheringSystem.drops = [];

    Object.assign(audio.settings, payload.audio);
    audio.applyVolumes();

    // Drone entities are runtime-only and are not part of the save payload.
    // Recreate them from the imported upgrade levels instead of retaining old jobs/cargo.
    droneSystem.drones = [];
    droneSystem.syncDrones(this.state);
    saveService.save(this.state, this.player, audio.settings, false);
    ui.refreshAll(() => this.state, () => this.player, () => this.getStats());
  }

  resetGame(): void {
    const {
      saveService,
      gatheringSystem,
      droneSystem,
      worldSystem,
      contractSystem,
      audio,
      ui,
      eventBus
    } = this.services;

    saveService.clear();
    this.state = createDefaultState();
    this.player = createDefaultPlayer();
    this.simulation.resetTimers();
    gatheringSystem.drops = [];
    droneSystem.drones = [];
    worldSystem.initNodes();
    this.state.contracts = contractSystem.generateContracts(1);
    droneSystem.syncDrones(this.state);

    saveService.save(this.state, this.player, audio.settings, false);
    ui.refreshAll(() => this.state, () => this.player, () => this.getStats());
    ui.closeAllModals();
    eventBus.emit('ui:toast', { message: '🌱 Nova jornada iniciada na Clareira do Vale!' });
  }

  render(): void {
    const { renderer, worldSystem, buildingSystem, droneSystem, gatheringSystem } = this.services;
    renderer.render(
      this.state,
      this.player,
      this.getStats(),
      worldSystem,
      buildingSystem,
      droneSystem.drones,
      gatheringSystem.drops,
      this.clock.worldTime
    );
  }
}
