import { DerivedStats, GameState, PlayerState, ResourceNode, SavePayload } from '../domain/types.ts';
import { createDefaultState } from '../domain/GameState.ts';
import { createDefaultPlayer } from '../domain/PlayerState.ts';
import { getDerivedStats } from '../domain/Stats.ts';
import { EventBus } from '../core/EventBus.ts';
import { GameClock } from '../core/GameClock.ts';
import { GameLoop } from '../core/GameLoop.ts';

import { WorldSystem } from '../gameplay/WorldSystem.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { PlayerSystem } from '../gameplay/PlayerSystem.ts';
import { GatheringSystem } from '../gameplay/GatheringSystem.ts';
import { BuildingSystem } from '../gameplay/BuildingSystem.ts';
import { MachineSystem } from '../gameplay/MachineSystem.ts';
import { DroneSystem } from '../gameplay/DroneSystem.ts';
import { EconomySystem } from '../gameplay/EconomySystem.ts';
import { ContractSystem } from '../gameplay/ContractSystem.ts';
import { UpgradeSystem } from '../gameplay/UpgradeSystem.ts';
import { ProgressionSystem } from '../gameplay/ProgressionSystem.ts';
import { AirshipSystem } from '../gameplay/AirshipSystem.ts';

import { CanvasRenderer } from '../rendering/CanvasRenderer.ts';
import { InputManager } from '../input/InputManager.ts';
import { AudioManager } from '../audio/AudioManager.ts';
import { SaveService } from '../persistence/SaveService.ts';
import { UIManager } from '../ui/UIManager.ts';
import { BlueprintConfig } from '../config/buildings.ts';

export class GameApp {
  public isPlaying: boolean = false;
  public state: GameState;
  public player: PlayerState;

  public clock: GameClock;
  public loop: GameLoop;
  public hoveredBlueprint: BlueprintConfig | null = null;
  private unloadTimer: number = 0;

  constructor(
    public eventBus: EventBus,
    public input: InputManager,
    public renderer: CanvasRenderer,
    public audio: AudioManager,
    public saveService: SaveService,
    public ui: UIManager,
    public worldSystem: WorldSystem,
    public inventorySystem: InventorySystem,
    public playerSystem: PlayerSystem,
    public gatheringSystem: GatheringSystem,
    public buildingSystem: BuildingSystem,
    public machineSystem: MachineSystem,
    public droneSystem: DroneSystem,
    public economySystem: EconomySystem,
    public contractSystem: ContractSystem,
    public upgradeSystem: UpgradeSystem,
    public progressionSystem: ProgressionSystem,
    public airshipSystem: AirshipSystem
  ) {
    this.state = createDefaultState();
    this.player = createDefaultPlayer();

    this.clock = new GameClock();
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );

    this.bindAppEvents();
  }

  getStats(): DerivedStats {
    return getDerivedStats(this.state);
  }

  private bindAppEvents(): void {
    // 1. Ações de entrada disparadas pelo InputManager
    this.eventBus.on('input:dash', () => this.triggerDash());
    this.eventBus.on('input:swing', () => this.triggerSwing());
    this.eventBus.on('input:interact', () => this.triggerContextInteract());

    this.eventBus.on('input:mouseMove', () => {
      this.input.updateWorldMouse(
        this.renderer.camera.x,
        this.renderer.camera.y,
        this.renderer.width,
        this.renderer.height
      );
      this.updateHoveredBlueprint();
    });

    this.eventBus.on('input:canvasClick', () => {
      this.handleCanvasClick();
    });

    // 2. Eventos de efeitos visuais para o renderer
    this.eventBus.on('fx:shake', (data: { magnitude?: number }) => {
      this.renderer.camera.addShake(data?.magnitude || 4);
    });

    this.eventBus.on('fx:burst', (data: { x: number; y: number; color: string; count?: number }) => {
      this.renderer.effectsRenderer.addBurst(data.x, data.y, data.color, data.count || 10);
    });

    this.eventBus.on('fx:floatingText', (data: { x: number; y: number; text: string; color?: string }) => {
      this.renderer.effectsRenderer.addFloatingText(data.x, data.y, data.text, data.color || '#fef3c7');
    });

    this.eventBus.on('game:hitstop', (data: { duration?: number }) => {
      this.clock.addHitStop(data?.duration || 0.032);
    });

    // 3. Solicitação de salvamento
    this.eventBus.on('save:request', (data: { silent?: boolean }) => {
      this.saveService.save(this.state, this.player, this.audio.settings, data?.silent ?? true);
    });

    // 4. Redimensionamento de janela
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });
  }

  init(): void {
    // Inicializa contratos se vazios
    if (!this.state.contracts || this.state.contracts.length === 0) {
      this.state.contracts = this.contractSystem.generateContracts(this.state.phase);
    }

    // Carrega save inicial se existir
    const saved = this.saveService.load();
    if (saved) {
      this.applySavePayload(saved);
      const startLbl = document.getElementById('btnStartLabel');
      if (startLbl) startLbl.textContent = 'Continuar Jornada';
    }

    this.input.init(this.renderer.canvas);
    this.droneSystem.syncDrones(this.state);

    this.ui.init(
      () => this.state,
      () => this.player,
      () => this.getStats(),
      () => {
        this.audio.init();
        this.audio.playUpgrade();
        this.isPlaying = true;
        this.ui.refreshAll(
          () => this.state,
          () => this.player,
          () => this.getStats()
        );
      },
      () => this.resetGame(),
      (payload) => this.applySavePayload(payload)
    );

    this.ui.refreshAll(
      () => this.state,
      () => this.player,
      () => this.getStats()
    );

    this.loop.start();
  }

  applySavePayload(payload: SavePayload): void {
    this.state = payload.state;
    this.player.x = payload.playerPos.x;
    this.player.y = payload.playerPos.y;
    this.player.backpack = [];
    this.gatheringSystem.drops = [];

    Object.assign(this.audio.settings, payload.audio);
    this.audio.applyVolumes();

    this.droneSystem.syncDrones(this.state);
    this.saveService.save(this.state, this.player, this.audio.settings, false);
    this.ui.refreshAll(
      () => this.state,
      () => this.player,
      () => this.getStats()
    );
  }

  resetGame(): void {
    this.saveService.clear();
    this.state = createDefaultState();
    this.player = createDefaultPlayer();
    this.gatheringSystem.drops = [];
    this.droneSystem.drones = [];
    this.worldSystem.initNodes();
    this.state.contracts = this.contractSystem.generateContracts(1);
    this.droneSystem.syncDrones(this.state);

    this.saveService.save(this.state, this.player, this.audio.settings, false);
    this.ui.refreshAll(
      () => this.state,
      () => this.player,
      () => this.getStats()
    );
    this.ui.closeAllModals();
    this.eventBus.emit('ui:toast', { message: '🌱 Nova jornada iniciada na Clareira do Vale!' });
  }

  triggerDash(): void {
    if (!this.isPlaying || this.ui.activeModal) return;
    this.audio.init();

    const stats = this.getStats();
    const input = this.input.getPlayerInput();
    const dashed = this.playerSystem.triggerDash(this.player, stats, {
      dx: input.ix,
      dy: input.iy
    });

    if (dashed) {
      this.audio.playDash();
      this.renderer.camera.addShake(4);

      if ((this.state.upgrades.steamDash ?? 0) > 0) {
        this.worldSystem.nodes.forEach(node => {
          if (
            !node.depleted &&
            node.reqPower <= stats.toolPower &&
            Math.hypot(node.x - this.player.x, node.y - this.player.y) < 105
          ) {
            this.gatheringSystem.damageNode(node, 1, false, this.state, stats);
          }
        });
      }

      for (let i = 0; i < 12; i++) {
        this.renderer.effectsRenderer.particles.push({
          x: this.player.x,
          y: this.player.y,
          vx: -this.player.dashDirX * (60 + Math.random() * 80) + (Math.random() - 0.5) * 60,
          vy: -this.player.dashDirY * (60 + Math.random() * 80) + (Math.random() - 0.5) * 60,
          size: 3 + Math.random() * 4,
          color: '#fde047',
          life: 0.35,
          maxLife: 0.35
        });
      }
    }
  }

  triggerSwing(): void {
    if (!this.isPlaying || this.ui.activeModal) return;
    this.audio.init();

    const stats = this.getStats();
    const swung = this.playerSystem.triggerSwing(this.player, stats);
    if (!swung) return;

    this.audio.playSwing();
    let hitAny = false;

    this.worldSystem.nodes.forEach(node => {
      if (node.depleted) return;
      const isl = this.worldSystem.islands.find(i => i.id === node.islandId);
      if (isl && !isl.unlocked(this.state)) return;

      const dx = node.x - this.player.x;
      const dy = node.y - this.player.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= stats.reachRadius + node.radius) {
        const angleToNode = Math.atan2(dy, dx);
        let diff = angleToNode - this.player.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) <= stats.swingArc * 0.72 || dist < 48) {
          hitAny = true;
          this.gatheringSystem.handleHitNode(node, this.state, stats);
        }
      }
    });

    if (hitAny) {
      this.renderer.camera.addShake(3.5);
    }
  }

  triggerContextInteract(): void {
    if (!this.isPlaying || this.ui.activeModal) return;

    // 1. Blueprint próxima
    const nearBp = this.buildingSystem.getNearbyBlueprint(this.player.x, this.player.y, this.state);
    if (nearBp) {
      this.buildingSystem.interactWithBlueprint(nearBp.id, this.state, this.player);
      return;
    }

    // 2. Perto da Banca do Mercador (-95, -25)
    if (Math.hypot(this.player.x - (-95), this.player.y - (-25)) < 95) {
      this.ui.openModal(
        'modalMerchant',
        () => this.state,
        () => this.player,
        () => this.getStats()
      );
      return;
    }

    // 3. Perto da Bancada de Upgrades (95, -25)
    if (Math.hypot(this.player.x - 95, this.player.y - (-25)) < 95) {
      this.ui.openModal(
        'modalWorkshop',
        () => this.state,
        () => this.player,
        () => this.getStats()
      );
      return;
    }

    // 4. Perto do Cais do Dirigível (0, -616)
    if (
      this.state.builds.airshipDock?.built &&
      Math.hypot(this.player.x - 0, this.player.y - (-616)) < 135
    ) {
      this.ui.openModal(
        'modalAirship',
        () => this.state,
        () => this.player,
        () => this.getStats()
      );
      return;
    }
  }

  handleCanvasClick(): void {
    if (!this.isPlaying || this.ui.activeModal) return;
    this.audio.init();

    this.input.updateWorldMouse(
      this.renderer.camera.x,
      this.renderer.camera.y,
      this.renderer.width,
      this.renderer.height
    );

    const mouseW = this.input.mouse;
    this.player.facing = Math.atan2(mouseW.worldY - this.player.y, mouseW.worldX - this.player.x);

    const stats = this.getStats();

    // 1. Clicou perto de um recurso
    const clickedNode = this.worldSystem.nodes.find(
      n =>
        !n.depleted &&
        Math.hypot(n.x - mouseW.worldX, n.y - mouseW.worldY) <= n.radius + 26
    );

    if (clickedNode) {
      const dist = Math.hypot(clickedNode.x - this.player.x, clickedNode.y - this.player.y);
      if (dist <= stats.reachRadius + clickedNode.radius) {
        this.player.moveTarget = null;
        this.triggerSwing();
      } else {
        this.player.moveTarget = { x: clickedNode.x, y: clickedNode.y, autoHitNode: clickedNode };
      }
      return;
    }

    // 2. Clicou na Banca do Mercador
    if (
      Math.hypot(mouseW.worldX - (-95), mouseW.worldY - (-25)) < 58 &&
      Math.hypot(this.player.x - (-95), this.player.y - (-25)) < 115
    ) {
      this.ui.openModal(
        'modalMerchant',
        () => this.state,
        () => this.player,
        () => this.getStats()
      );
      return;
    }

    // 3. Se há nó no alcance na direção do clique, golpeia; senão anda até lá
    const hasNodeInRange = this.worldSystem.nodes.some(
      n =>
        !n.depleted &&
        Math.hypot(n.x - this.player.x, n.y - this.player.y) <= stats.reachRadius + n.radius
    );

    if (hasNodeInRange) {
      this.player.moveTarget = null;
      this.triggerSwing();
    } else if (this.worldSystem.isPointWalkable(this.state, mouseW.worldX, mouseW.worldY)) {
      this.player.moveTarget = { x: mouseW.worldX, y: mouseW.worldY };
    } else {
      this.triggerSwing();
    }
  }

  updateHoveredBlueprint(): void {
    this.hoveredBlueprint = null;
    const mouseW = this.input.mouse;

    for (const bp of this.buildingSystem.blueprints) {
      if (this.state.builds[bp.id]?.built) continue;
      if (
        mouseW.worldX >= bp.x - 12 &&
        mouseW.worldX <= bp.x + bp.w + 12 &&
        mouseW.worldY >= bp.y - 12 &&
        mouseW.worldY <= bp.y + bp.h + 12
      ) {
        this.hoveredBlueprint = bp;
        break;
      }
    }
  }

  update(dt: number): void {
    const clockInfo = this.clock.update(dt);

    // Atualiza nuvens do mundo
    this.worldSystem.clouds.forEach(c => {
      c.x += c.speed * dt;
      if (c.x > 1400) c.x = -1400;
    });

    if (!this.isPlaying) {
      this.renderer.camera.setIdlePan(this.clock.worldTime);
      return;
    }

    if (clockInfo.isHitStopped) {
      return;
    }

    const stats = this.getStats();

    // 1. Movimentação do Jogador
    if (!this.ui.activeModal) {
      const inputState = this.input.getPlayerInput();
      this.playerSystem.update(
        this.player,
        this.state,
        stats,
        dt,
        inputState,
        (s, x, y) => this.worldSystem.isPointWalkable(s, x, y),
        (node) => this.gatheringSystem.handleHitNode(node, this.state, stats)
      );
    }

    // 2. Descarregamento automático perto do Armazém (95, -25)
    if (
      this.player.backpack.length > 0 &&
      Math.hypot(this.player.x - 95, this.player.y - (-25)) < 82
    ) {
      this.unloadTimer -= dt;
      if (this.unloadTimer <= 0) {
        this.unloadTimer = 0.06;
        const res = this.inventorySystem.unloadOneToStorage(this.state, this.player);
        if (res) {
          this.audio.playPickup();
          this.ui.hudView.update(this.state, this.player, stats);
        }
      }
    }

    // 3. Atualizar Nós do Mundo
    this.worldSystem.update(dt, (node) => {
      this.renderer.effectsRenderer.addBurst(node.x, node.y, '#a7f3d0', 10);
    });

    // 4. Atualizar Drops
    this.gatheringSystem.updateDrops(this.player, stats, dt, (drop) => {
      this.inventorySystem.addToBackpack(this.player, drop.resource, stats.maxBackpack);
      this.audio.playPickup();
      this.ui.hudView.update(this.state, this.player, stats);
    });

    // 5. Expedição do Dirigível
    this.airshipSystem.update(this.state, dt);

    // 6. Máquinas de Processamento & Drones
    this.machineSystem.update(this.state, this.player, stats, dt);
    this.droneSystem.update(this.state, stats, this.worldSystem.nodes, this.worldSystem.islands, dt);

    // 7. Partículas e Textos Flutuantes
    this.renderer.effectsRenderer.update(dt);

    // 8. Câmera
    this.renderer.camera.update(this.player.x, this.player.y, dt);

    // 9. Atualizar Cartão de Inspeção
    const targetBp =
      this.buildingSystem.getNearbyBlueprint(this.player.x, this.player.y, this.state) ||
      this.hoveredBlueprint;

    this.ui.inspectionCard.update(
      targetBp,
      this.state,
      this.player,
      this.buildingSystem,
      this.inventorySystem,
      this.renderer.camera,
      this.renderer.width,
      this.renderer.height,
      Boolean(this.ui.activeModal)
    );

    // 10. Ticks Periódicos de UI e Autosave
    if (clockInfo.shouldTickUI) {
      this.ui.hudView.update(this.state, this.player, stats);
      if (this.ui.activeModal === 'modalAirship' && this.state.airship.activeRouteId) {
        this.ui.airshipModal.render(this.state, this.player, stats);
      }
    }

    if (clockInfo.shouldAutoSave) {
      this.saveService.save(this.state, this.player, this.audio.settings, true);
    }
  }

  render(): void {
    this.renderer.render(
      this.state,
      this.player,
      this.getStats(),
      this.worldSystem,
      this.buildingSystem,
      this.droneSystem.drones,
      this.gatheringSystem.drops,
      this.clock.worldTime
    );
  }
}
