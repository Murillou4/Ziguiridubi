import { DerivedStats, DropItem, GameState, NodeType, PlayerState, SavePayload } from '../domain/types.ts';
import { createDefaultState } from '../domain/GameState.ts';
import { createDefaultPlayer } from '../domain/PlayerState.ts';
import { getDerivedStats } from '../domain/Stats.ts';
import { GameClock } from '../core/GameClock.ts';
import { GameLoop } from '../core/GameLoop.ts';
import { BlueprintConfig } from '../config/buildings.ts';
import { DRONE_KINDS, DRONE_MODELS } from '../config/drones.ts';
import { GameAppServices, GameRuntimeContext } from './GameContext.ts';
import { GameSimulationController } from './GameSimulationController.ts';
import { PlayerInteractionController } from './PlayerInteractionController.ts';
import { TutorialController } from './TutorialController.ts';
import { AccountFlow } from './AccountFlow.ts';
import { createDefaultAudioSettings } from '../audio/AudioSettings.ts';

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
  private readonly tutorial: TutorialController;

  constructor(services: GameAppServices) {
    this.services = services;
    this.state = createDefaultState();
    this.player = createDefaultPlayer();
    this.clock = new GameClock();
    this.tutorial = new TutorialController(services.inventorySystem, services.buildingSystem);

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

    this.interactions = new PlayerInteractionController(context);
    this.simulation = new GameSimulationController(context, this.interactions);

    this.loop = new GameLoop(
      (dt, isCatchingUp) => {
        const { x, y } = this.player;
        this.simulation.update(dt, isCatchingUp);
        if (!this.isPlaying) return;

        if (this.tutorial.recordMovement(this.state, Math.hypot(this.player.x - x, this.player.y - y)) ||
            this.tutorial.finishPickup(this.state, this.clock.worldTime)) {
          this.services.eventBus.emit('save:request');
        }
      },
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

    const canControlCamera = () => this.isPlaying && !this.services.ui.activeModal;
    eventBus.on('input:cameraPan', ({ dx, dy }: { dx: number; dy: number }) => {
      if (canControlCamera()) renderer.camera.pan(dx, dy);
    });
    eventBus.on('input:cameraZoom', ({ factor, x, y }: { factor: number; x: number; y: number }) => {
      if (!canControlCamera()) return;
      renderer.camera.changeZoom(
        factor,
        x - renderer.width / 2,
        y - renderer.height / 2
      );
    });
    eventBus.on('input:cameraRecenter', () => {
      if (canControlCamera()) renderer.camera.recenter(this.player.x, this.player.y);
    });

    eventBus.on('input:mouseMove', () => {
      input.updateWorldMouse(
        renderer.camera,
        renderer.width,
        renderer.height
      );
      this.interactions.updateHoveredBlueprint();
    });

    eventBus.on('input:canvasClick', () => this.interactions.handleCanvasClick(this.getTutorialCue()));

    eventBus.on('gathering:depleted', (type: NodeType) => {
      if (this.tutorial.recordDepletion(this.state, type)) eventBus.emit('save:request');
    });
    eventBus.on('gathering:pickedUp', (drop: DropItem) => {
      this.tutorial.recordPickup(this.state, drop, this.clock.worldTime);
    });
    eventBus.on('building:deposited', (id: string) => this.tutorial.recordDeposit(this.state, id));

    eventBus.on('upgrade:purchased', (data: { id?: string }) => {
      if (DRONE_KINDS.some(kind => DRONE_MODELS[kind].upgrade === data?.id)) {
        droneSystem.syncDrones(this.state);
      }
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

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => renderer.resize());
      window.addEventListener('focus', () => {
        this.clock.syncRealTime(new Date(), false);
        audio.resumeIfNeeded?.();
        this.services.ui?.refreshAll?.(
          () => this.state,
          () => this.player,
          () => this.getStats()
        );
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.isPlaying) saveService.save(this.state, this.player, audio.settings);
        } else {
          this.clock.syncRealTime(new Date(), true);
          audio.resumeIfNeeded?.();
          this.services.ui?.refreshAll?.(
            () => this.state,
            () => this.player,
            () => this.getStats()
          );
          this.render();
        }
      });
    }
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
      this.applySavePayload(saved, false);
      const startLabel = document.getElementById('btnStartLabel');
      if (startLabel) startLabel.textContent = 'Continuar jornada';
    }

    input.init(renderer.canvas, () => this.isPlaying, () => Boolean(ui.activeModal));
    droneSystem.syncDrones(this.state);

    ui.init(
      () => this.state,
      () => this.player,
      () => this.getStats(),
      () => {
        audio.init();
        audio.playUpgrade();
        renderer.camera.zoom = 1;
        renderer.camera.recenter(this.player.x, this.player.y);
        this.isPlaying = true;
        ui.refreshAll(() => this.state, () => this.player, () => this.getStats());
      },
      () => this.resetGame(),
      payload => this.applySavePayload(payload)
    );

    ui.refreshAll(() => this.state, () => this.player, () => this.getStats());
    new AccountFlow(saveService, {
      checkpoint: () => {
        if (this.isPlaying) saveService.save(this.state, this.player, audio.settings);
      },
      leaveGame: () => {
        if (this.isPlaying) saveService.save(this.state, this.player, audio.settings);
        this.isPlaying = false;
        input.resetInputs();
        ui.closeAllModals();
        ui.inspectionCard.hide();
        ui.showTitle();
      },
      load: payload => {
        this.player = createDefaultPlayer();
        this.services.worldSystem.initNodes();
        const newState = createDefaultState();
        if (!payload) newState.contracts = contractSystem.generateContracts(newState.phase);
        this.applySavePayload(payload ?? saveService.buildSavePayload(newState, this.player, createDefaultAudioSettings()), false);
        const label = document.getElementById('btnStartLabel');
        if (label) label.textContent = payload ? 'Continuar jornada' : 'Iniciar jornada';
      }
    }).init();
    this.loop.start();
  }

  applySavePayload(payload: SavePayload, persist = true): void {
    const { audio, droneSystem, saveService, ui, gatheringSystem } = this.services;

    this.state = payload.state;
    this.player.x = payload.playerPos.x;
    this.player.y = payload.playerPos.y;
    // Older saves can point to terrain that moved when the islands expanded.
    if (!this.services.worldSystem.isPointWalkable(this.state, this.player.x, this.player.y)) {
      this.player.x = 0;
      this.player.y = 0;
    }
    this.player.backpack = [];
    gatheringSystem.drops = [];
    this.simulation.resetTimers();

    Object.assign(audio.settings, payload.audio);
    audio.applyVolumes();

    // Drone entities are runtime-only and are not part of the save payload.
    // Recreate them from the imported upgrade levels instead of retaining old jobs/cargo.
    droneSystem.drones = [];
    droneSystem.syncDrones(this.state);
    if (persist) saveService.save(this.state, this.player, audio.settings, false);
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
    eventBus.emit('ui:toast', { message: 'Nova jornada iniciada na Clareira do Vale!' });
  }

  private getTutorialCue(stats = this.getStats()) {
    const { ui, worldSystem, gatheringSystem } = this.services;
    if (!this.isPlaying || ui.activeModal || !this.state.tutorialStep || this.state.tutorialStep === 'done') return null;
    return this.tutorial.getCue(
      this.state, this.player, worldSystem.nodes, gatheringSystem.drops, stats.maxBackpack,
      ui.inspectionCard.activeInspectedZone?.id
    );
  }

  render(): void {
    const { renderer, worldSystem, buildingSystem, droneSystem, gatheringSystem, ui, input } = this.services;
    const stats = this.getStats();
    const tutorialCue = this.getTutorialCue(stats);
    ui.hudView.updateTutorial(tutorialCue, input.mode);
    renderer.render(
      this.state,
      this.player,
      stats,
      worldSystem,
      buildingSystem,
      droneSystem.drones,
      gatheringSystem.drops,
      this.clock.worldTime,
      ui.activeModal,
      this.isPlaying,
      this.clock.realTime,
      Boolean(ui.inspectionCard.activeInspectedZone),
      tutorialCue
    );
  }
}
