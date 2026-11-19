import { DerivedStats, GameState, PlayerState, SavePayload } from '../domain/types.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { BuildingSystem } from '../gameplay/BuildingSystem.ts';
import { EconomySystem } from '../gameplay/EconomySystem.ts';
import { ContractSystem } from '../gameplay/ContractSystem.ts';
import { UpgradeSystem } from '../gameplay/UpgradeSystem.ts';
import { ProgressionSystem } from '../gameplay/ProgressionSystem.ts';
import { AirshipSystem } from '../gameplay/AirshipSystem.ts';
import { AudioManager } from '../audio/AudioManager.ts';
import { SaveService } from '../persistence/SaveService.ts';
import { EventBus } from '../core/EventBus.ts';

import { ToastManager } from './ToastManager.ts';
import { WorldInspectionCard } from './WorldInspectionCard.ts';
import { HUDView } from './HUDView.ts';
import { MerchantModal } from './MerchantModal.ts';
import { WorkshopModal } from './WorkshopModal.ts';
import { ProjectsModal } from './ProjectsModal.ts';
import { AirshipModal } from './AirshipModal.ts';
import { TransferModal } from './TransferModal.ts';
import { SettingsModal } from './SettingsModal.ts';

export class UIManager {
  public activeModal: string | null = null;

  public toastManager = new ToastManager();
  public inspectionCard = new WorldInspectionCard();
  public hudView: HUDView;
  public merchantModal: MerchantModal;
  public workshopModal: WorkshopModal;
  public projectsModal: ProjectsModal;
  public airshipModal: AirshipModal;
  public transferModal: TransferModal;
  public settingsModal: SettingsModal;

  constructor(
    private inventorySystem: InventorySystem,
    private buildingSystem: BuildingSystem,
    private economySystem: EconomySystem,
    private contractSystem: ContractSystem,
    private upgradeSystem: UpgradeSystem,
    private progressionSystem: ProgressionSystem,
    private airshipSystem: AirshipSystem,
    private audioManager: AudioManager,
    private saveService: SaveService,
    private eventBus: EventBus
  ) {
    this.hudView = new HUDView(this.inventorySystem);
    this.merchantModal = new MerchantModal(this.inventorySystem, this.economySystem, this.contractSystem);
    this.workshopModal = new WorkshopModal(this.inventorySystem, this.upgradeSystem, this.progressionSystem);
    this.projectsModal = new ProjectsModal(this.inventorySystem, this.eventBus);
    this.airshipModal = new AirshipModal(this.inventorySystem, this.airshipSystem);
    this.transferModal = new TransferModal(this.saveService, this.eventBus);
    this.settingsModal = new SettingsModal(this.audioManager, this.eventBus);
  }

  init(
    getState: () => GameState,
    getPlayer: () => PlayerState,
    getStats: () => DerivedStats,
    onStartGame: () => void,
    onResetConfirmed: () => void,
    onPayloadLoaded: (payload: SavePayload) => void
  ): void {
    this.toastManager.init();
    this.inspectionCard.init();

    // 1. Tela Inicial
    const btnStart = document.getElementById('btnStartGame');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        onStartGame();
        const title = document.getElementById('titleScreen');
        if (title) {
          title.style.opacity = '0';
          setTimeout(() => {
            title.style.display = 'none';
          }, 450);
        }
        const hud = document.getElementById('hudLayer');
        if (hud) {
          hud.classList.remove('hidden');
          hud.classList.add('flex');
        }
      });
    }

    // 2. Botões do Dock Inferior e HUD
    document.getElementById('btnOpenMerchant')?.addEventListener('click', () => this.toggleModal('modalMerchant', getState, getPlayer, getStats));
    document.getElementById('btnOpenWorkshop')?.addEventListener('click', () => this.toggleModal('modalWorkshop', getState, getPlayer, getStats));
    document.getElementById('btnOpenProjects')?.addEventListener('click', () => this.toggleModal('modalProjects', getState, getPlayer, getStats));
    document.getElementById('btnOpenAirship')?.addEventListener('click', () => this.toggleModal('modalAirship', getState, getPlayer, getStats));
    document.getElementById('btnOpenTransfer')?.addEventListener('click', () => this.toggleModal('modalTransfer', getState, getPlayer, getStats));
    document.getElementById('btnOpenSettings')?.addEventListener('click', () => this.toggleModal('modalSettings', getState, getPlayer, getStats));
    document.getElementById('btnHowToPlay')?.addEventListener('click', () => this.toggleModal('modalHowToPlay', getState, getPlayer, getStats));
    document.getElementById('btnOpenTransferFromSettings')?.addEventListener('click', () => this.openModal('modalTransfer', getState, getPlayer, getStats));
    document.getElementById('btnCollectAirshipHud')?.addEventListener('click', () => {
      this.airshipSystem.collectRewards(getState(), getStats());
    });

    // 3. Ação do Cartão de Inspeção do Mundo
    document.getElementById('wicActionBtn')?.addEventListener('click', () => {
      if (this.inspectionCard.activeInspectedZone) {
        this.buildingSystem.interactWithBlueprint(this.inspectionCard.activeInspectedZone.id, getState(), getPlayer());
      }
    });

    // 4. Venda de Excedentes
    document.getElementById('btnSellSurplus')?.addEventListener('click', () => {
      this.economySystem.sellAllSurplus(getState(), getPlayer(), getStats());
    });

    // 5. Fechamento de Modais
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    document.querySelectorAll('[data-modal-backdrop]').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeAllModals();
      });
    });

    // 6. Inicializa Modais Especializados
    this.transferModal.init(getState, getPlayer, () => this.audioManager.settings, onPayloadLoaded);
    this.settingsModal.init(onResetConfirmed);

    // 7. Eventos do EventBus
    this.eventBus.on('ui:toast', (data: { message?: string }) => {
      if (data?.message) this.toastManager.show(data.message);
    });

    this.eventBus.on('ui:hud', () => {
      this.hudView.update(getState(), getPlayer(), getStats());
    });

    this.eventBus.on('ui:refresh', () => {
      this.refreshAll(getState, getPlayer, getStats);
    });

    this.eventBus.on('ui:closeModals', () => this.closeAllModals());

    this.eventBus.on('input:escape', () => {
      if (this.activeModal) this.closeAllModals();
      else this.openModal('modalSettings', getState, getPlayer, getStats);
    });

    this.eventBus.on('input:openMerchant', () => this.toggleModal('modalMerchant', getState, getPlayer, getStats));
    this.eventBus.on('input:openWorkshop', () => this.toggleModal('modalWorkshop', getState, getPlayer, getStats));
    this.eventBus.on('input:openProjects', () => this.toggleModal('modalProjects', getState, getPlayer, getStats));
    this.eventBus.on('input:openAirship', () => {
      if (getState().builds.airshipDock?.built) {
        this.toggleModal('modalAirship', getState, getPlayer, getStats);
      }
    });
    this.eventBus.on('input:openSettings', () => this.toggleModal('modalSettings', getState, getPlayer, getStats));

    this.eventBus.on('save:indicator', () => {
      const ind = document.getElementById('saveIndicator');
      if (ind) {
        ind.style.opacity = '1';
        setTimeout(() => { ind.style.opacity = '0'; }, 1700);
      }
    });
  }

  toggleModal(
    modalId: string,
    getState: () => GameState,
    getPlayer: () => PlayerState,
    getStats: () => DerivedStats
  ): void {
    if (this.activeModal === modalId) {
      this.closeAllModals();
    } else {
      this.openModal(modalId, getState, getPlayer, getStats);
    }
  }

  openModal(
    modalId: string,
    getState: () => GameState,
    getPlayer: () => PlayerState,
    getStats: () => DerivedStats
  ): void {
    this.closeAllModals();
    const el = document.getElementById(modalId);
    if (!el) return;

    el.classList.remove('hidden');
    el.classList.add('flex');
    this.activeModal = modalId;
    getPlayer().moveTarget = null;

    if (modalId === 'modalMerchant') {
      this.merchantModal.render(getState(), getPlayer(), getStats());
    } else if (modalId === 'modalWorkshop') {
      this.workshopModal.render(getState(), getPlayer());
    } else if (modalId === 'modalProjects') {
      this.projectsModal.render(getState(), getPlayer());
    } else if (modalId === 'modalAirship') {
      this.airshipModal.render(getState(), getPlayer(), getStats());
    } else if (modalId === 'modalTransfer') {
      this.transferModal.refreshCode(getState(), getPlayer(), this.audioManager.settings);
    } else if (modalId === 'modalSettings') {
      this.settingsModal.syncSliders();
    }
  }

  closeAllModals(): void {
    document.querySelectorAll('[id^="modal"]').forEach(m => {
      m.classList.add('hidden');
      m.classList.remove('flex');
    });
    this.activeModal = null;
  }

  refreshActiveModalResources(state: GameState, player: PlayerState): void {
    if (this.activeModal === 'modalWorkshop') {
      this.workshopModal.refreshResources(state, player);
    }
  }

  refreshAll(
    getState: () => GameState,
    getPlayer: () => PlayerState,
    getStats: () => DerivedStats
  ): void {
    const state = getState();
    const player = getPlayer();
    const stats = getStats();

    this.hudView.update(state, player, stats);
    this.settingsModal.syncSliders();

    const airBtn = document.getElementById('btnOpenAirship');
    if (airBtn) {
      if (state.builds.airshipDock?.built) {
        airBtn.classList.remove('hidden');
        airBtn.classList.add('flex');
      } else {
        airBtn.classList.add('hidden');
        airBtn.classList.remove('flex');
      }
    }

    // A compra pode alterar nível, custo e disponibilidade do upgrade selecionado.
    if (this.activeModal === 'modalWorkshop') {
      this.workshopModal.render(state, player);
    }
  }
}
