import { DerivedStats, GameState, PlayerState, SavePayload } from '../domain/types.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { BuildingSystem } from '../gameplay/BuildingSystem.ts';
import { EconomySystem } from '../gameplay/EconomySystem.ts';
import { ContractSystem } from '../gameplay/ContractSystem.ts';
import { UpgradeSystem } from '../gameplay/UpgradeSystem.ts';
import { MachineSystem } from '../gameplay/MachineSystem.ts';
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
  private modalTrigger: HTMLElement | null = null;

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
    machineSystem: MachineSystem,
    private progressionSystem: ProgressionSystem,
    private airshipSystem: AirshipSystem,
    private audioManager: AudioManager,
    private saveService: SaveService,
    private eventBus: EventBus
  ) {
    this.hudView = new HUDView(this.inventorySystem);
    this.merchantModal = new MerchantModal(this.inventorySystem, this.economySystem, this.contractSystem);
    this.workshopModal = new WorkshopModal(this.inventorySystem, this.upgradeSystem, this.progressionSystem, machineSystem);
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
          title.inert = true;
          title.style.opacity = '0';
          setTimeout(() => {
            if (title.inert) title.style.display = 'none';
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
    const hud = document.getElementById('hudLayer');
    const dock = document.getElementById('hudDock');
    if (hud && dock) {
      dock.querySelectorAll<HTMLButtonElement>('button[aria-controls]').forEach(button => {
        button.addEventListener('click', () => {
          const modalId = button.getAttribute('aria-controls');
          if (modalId) this.toggleModal(modalId, getState, getPlayer, getStats, button);
        });
      });

      const updateDockClearance = () => {
        const bounds = dock.getBoundingClientRect();
        if (bounds.height === 0) return;
        const clearance = Math.ceil(hud.getBoundingClientRect().bottom - bounds.top) + 10;
        hud.style.setProperty('--modal-dock-clearance', `${clearance}px`);
      };
      const dockObserver = new ResizeObserver(updateDockClearance);
      dockObserver.observe(dock);
      window.addEventListener('resize', updateDockClearance);
      hud.addEventListener('keydown', event => this.wrapMenuFocus(event, dock));
    }
    document.getElementById('btnOpenSettings')?.addEventListener('click', () => this.toggleModal('modalSettings', getState, getPlayer, getStats));
    document.getElementById('btnHowToPlay')?.addEventListener('click', () => this.toggleModal('modalHowToPlay', getState, getPlayer, getStats));
    document.getElementById('btnOpenTransferFromSettings')?.addEventListener('click', () => this.openModal('modalTransfer', getState, getPlayer, getStats));
    document.getElementById('btnCollectAirshipHud')?.addEventListener('click', () => {
      this.airshipSystem.collectRewards(getState(), getStats());
    });
    const droneSwitch = document.getElementById('btnDroneFarms');
    droneSwitch?.addEventListener('click', () => {
      const state = getState();
      state.droneFarmsPaused = !state.droneFarmsPaused;
      this.eventBus.emit('ui:hud');
      this.eventBus.emit('save:request', { silent: false });
    });

    // 3. Ação do Cartão de Inspeção do Mundo
    document.getElementById('wicActionBtn')?.addEventListener('click', () => {
      if (this.inspectionCard.activeInspectedZone) {
        this.buildingSystem.interactWithBlueprint(this.inspectionCard.activeInspectedZone.id, getState(), getPlayer());
      }
    });

    this.merchantModal.init(getState, getPlayer, getStats);

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

    this.eventBus.on<string | undefined>('ui:closeModals', modalId => {
      if (!modalId || modalId === this.activeModal) this.closeAllModals();
    });

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

  showTitle(): void {
    const title = document.getElementById('titleScreen');
    if (title) {
      title.inert = false;
      title.style.display = '';
      title.style.opacity = '1';
    }
    const hud = document.getElementById('hudLayer');
    hud?.classList.remove('flex');
    hud?.classList.add('hidden');
  }

  toggleModal(
    modalId: string,
    getState: () => GameState,
    getPlayer: () => PlayerState,
    getStats: () => DerivedStats,
    trigger?: HTMLElement
  ): void {
    if (this.activeModal === modalId) {
      this.closeAllModals();
    } else {
      this.openModal(modalId, getState, getPlayer, getStats, trigger);
    }
  }

  openModal(
    modalId: string,
    getState: () => GameState,
    getPlayer: () => PlayerState,
    getStats: () => DerivedStats,
    trigger?: HTMLElement
  ): void {
    const el = document.getElementById(modalId);
    if (!el) return;

    const focused = document.activeElement;
    const returnFocus = this.activeModal ? this.modalTrigger : focused instanceof HTMLElement ? focused : null;
    if (this.activeModal !== modalId) this.hideActiveModal();
    el.classList.remove('hidden');
    el.classList.add('flex');
    this.activeModal = modalId;
    this.modalTrigger = trigger ?? returnFocus;
    this.syncMenuState();
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
    el.querySelector<HTMLElement>('[data-close-modal]')?.focus({ preventScroll: true });
  }

  closeAllModals(): void {
    this.hideActiveModal();
    this.activeModal = null;
    this.syncMenuState();
    this.modalTrigger?.focus({ preventScroll: true });
    this.modalTrigger = null;
  }

  private hideActiveModal(): void {
    if (!this.activeModal) return;
    const modal = document.getElementById(this.activeModal);
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  }

  private syncMenuState(): void {
    const open = this.activeModal !== null;
    document.getElementById('hudLayer')?.toggleAttribute('data-menu-open', open);
    document.querySelectorAll<HTMLElement>('.hud-top, #airshipFlightBanner, #touchControls, #worldInspectionCard, #btnDroneFarms')
      .forEach(element => { element.inert = open; });
    document.querySelectorAll('#hudDock button[aria-controls]').forEach(button => {
      button.setAttribute('aria-expanded', String(button.getAttribute('aria-controls') === this.activeModal));
    });
  }

  private wrapMenuFocus(event: KeyboardEvent, dock: HTMLElement): void {
    if (event.key !== 'Tab' || !this.activeModal) return;
    const panel = document.getElementById(this.activeModal);
    if (!panel) return;
    const selector = 'button, input, textarea, select, summary, a[href], [tabindex]';
    const controls = [...dock.querySelectorAll<HTMLElement>(selector), ...panel.querySelectorAll<HTMLElement>(selector)]
      .filter(control => control.tabIndex >= 0 && !control.matches(':disabled') && control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || document.activeElement !== (event.shiftKey ? first : last)) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }

  refreshActiveModalResources(state: GameState, player: PlayerState, stats: DerivedStats): void {
    if (this.activeModal === 'modalWorkshop') {
      this.workshopModal.refreshResources(state, player);
    } else if (this.activeModal === 'modalMerchant') {
      this.merchantModal.render(state, player, stats);
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
