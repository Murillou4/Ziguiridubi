import { GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { BLUEPRINTS_DEF, BlueprintConfig } from '../config/buildings.ts';
import { RESOURCES } from '../config/resources.ts';
import { BuildingSystem } from '../gameplay/BuildingSystem.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { resourceIcon } from './resource-icon.ts';
import type { InputMode } from '../input/InputManager.ts';

export class WorldInspectionCard {
  public activeInspectedZone: BlueprintConfig | null = null;
  private cardEl: HTMLElement | null = null;

  init(): void {
    this.cardEl = document.getElementById('worldInspectionCard');
    document.getElementById('wicCloseBtn')?.addEventListener('click', () => this.hide());
  }

  open(blueprint: BlueprintConfig): void {
    this.activeInspectedZone = blueprint;
  }

  hide(): void {
    if (this.cardEl) {
      this.cardEl.classList.add('hidden');
    }
    this.activeInspectedZone = null;
  }

  update(
    targetBp: BlueprintConfig | null,
    state: GameState,
    player: PlayerState,
    buildingSystem: BuildingSystem,
    inventorySystem: InventorySystem,
    camera: { x: number; y: number },
    screenWidth: number,
    screenHeight: number,
    isModalActive: boolean,
    inputMode: InputMode = 'keyboard'
  ): void {
    if (!this.cardEl) this.init();
    if (!this.cardEl) return;

    if (isModalActive || !targetBp || state.builds[targetBp.id]?.built) {
      this.hide();
      return;
    }

    this.activeInspectedZone = targetBp;
    const buildState = state.builds[targetBp.id];
    if (!buildState) {
      this.hide();
      return;
    }
    const tutorialDeposit = state.tutorialStep === 'deposit' && targetBp.id === 'sawmill';
    this.cardEl.toggleAttribute('data-tutorial-deposit', tutorialDeposit);

    const titleEl = document.getElementById('wicTitle');
    const descEl = document.getElementById('wicDesc');
    const pctEl = document.getElementById('wicProgressPct');
    const costsEl = document.getElementById('wicCosts');
    const btnEl = document.getElementById('wicActionBtn') as HTMLButtonElement | null;
    const btnTextEl = document.getElementById('wicActionText');

    if (titleEl) titleEl.textContent = targetBp.name;
    if (descEl) descEl.textContent = targetBp.desc;
    if (pctEl) {
      pctEl.textContent = `${buildingSystem.getBlueprintProgressPct(targetBp, state)}%`;
    }

    let canDepositAny = false;
    const costsHtml = Object.entries(targetBp.cost).map(([resKey, needed]) => {
      const res = resKey as ResourceId;
      const def = RESOURCES[res];
      const paid = buildState.paid[res] || 0;
      const missing = (needed || 0) - paid;
      const haveInBag = inventorySystem.getTotalResource(state, player, res);
      const satisfied = paid >= (needed || 0);
      const readyToDeposit = !satisfied && haveInBag > 0;
      if (readyToDeposit) canDepositAny = true;

      return `
        <div class="flex items-center justify-between ${
          satisfied
            ? 'ui-ink-moss'
            : haveInBag >= missing
            ? 'ui-ink-moss'
            : 'ui-ink-clay'
        }">
          <span>${resourceIcon(res, true)} ${def.name}</span>
          <span class="font-bold">${paid + Math.min(missing, haveInBag)}/${needed} ${
        satisfied ? '✓' : ''
      }</span>
        </div>
      `;
    }).join('');

    if (costsEl) costsEl.innerHTML = costsHtml;

    if (btnEl && btnTextEl) {
      const requiredBuild = targetBp.requiresBuild;
      const blockedByBuild = requiredBuild && !state.builds[requiredBuild]?.built;
      if (canDepositAny && !blockedByBuild) {
        btnEl.disabled = false;
        btnEl.className =
          'mt-3 w-full py-2 px-3 rounded-xl ui-fill-honey ui-hover-honey ui-ink font-bold text-xs shadow transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5';
        btnTextEl.textContent = tutorialDeposit
          ? `${inputMode === 'mouse' ? '' : '[E] '}Depositar madeira`
          : '[E] Construir / Depositar Recursos';
      } else {
        btnEl.disabled = true;
        btnEl.className =
          'mt-3 w-full py-2 px-3 rounded-xl ui-fill-inset ui-ink-muted font-semibold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed';
        const prerequisite = BLUEPRINTS_DEF.find(bp => bp.id === requiredBuild);
        btnTextEl.textContent = blockedByBuild && prerequisite
          ? `Requer ${prerequisite.name.split(':')[0]}`
          : 'Colete ou Venda Recursos para Construir';
      }
    }

    // Card stays in a stable HUD area rather than floating over the world target.
    const clampedX = Math.max(160, Math.min(screenWidth - 160, screenWidth / 2));
    const clampedY = Math.max(108, Math.min(screenHeight - 180, 124));

    this.cardEl.style.left = `${clampedX}px`;
    this.cardEl.style.top = `${clampedY}px`;
    this.cardEl.style.transform = 'translate(-50%, 0)';
    this.cardEl.classList.remove('hidden');
  }
}
