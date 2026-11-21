import { GameState, PlayerState, ResourceId, SpecializationId } from '../domain/types.ts';
import { UPGRADE_CATEGORIES, UPGRADES_DEF } from '../config/upgrades.ts';
import { SPECIALIZATIONS } from '../config/specializations.ts';
import { MACHINE_RECIPES, type MachineId } from '../config/machines.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';
import { resourceIcon } from './resource-icon.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { UpgradeSystem } from '../gameplay/UpgradeSystem.ts';
import { ProgressionSystem } from '../gameplay/ProgressionSystem.ts';
import { MachineSystem } from '../gameplay/MachineSystem.ts';

const machineRecipes = Object.values(MACHINE_RECIPES);

export class WorkshopModal {
  public activeUpgradeTab: string = 'tools';

  constructor(
    private inventorySystem: InventorySystem,
    private upgradeSystem: UpgradeSystem,
    private progressionSystem: ProgressionSystem,
    private machineSystem: MachineSystem
  ) {}

  render(state: GameState, player: PlayerState): void {
    const tabsEl = document.getElementById('upgradeTabs');
    if (!tabsEl) return;

    const tabs = [...UPGRADE_CATEGORIES];
    if (state.phase >= 5) {
      tabs.push({ id: 'specialization' as any, label: 'Especialização', icon: '' });
    }

    tabsEl.innerHTML = tabs.map(t => {
      const active = this.activeUpgradeTab === t.id;
      return `
        <button data-upg-tab="${t.id}" class="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
          active
            ? 'ui-fill-honey ui-ink shadow'
            : 'ui-fill-light ui-hover-light ui-ink-muted'
        }">
          ${t.label}
        </button>
      `;
    }).join('');

    tabsEl.querySelectorAll('[data-upg-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeUpgradeTab = btn.getAttribute('data-upg-tab')!;
        this.render(state, player);
      });
    });

    const listEl = document.getElementById('upgradeList');
    if (!listEl) return;

    if (this.activeUpgradeTab === 'specialization') {
      listEl.innerHTML = SPECIALIZATIONS.map(sp => {
        const active = state.specialization === sp.id;
        return `
          <div class="rounded-2xl p-4 border flex flex-col justify-between ${
            active ? 'ui-fill-sand ui-edge-honey' : 'ui-fill-light ui-edge'
          }">
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-base font-bold ui-ink">${sp.name}</span>
                ${
                  active
                    ? '<span class="px-2 py-0.5 rounded-full ui-fill-honey ui-ink text-[10px] font-bold">ATIVA</span>'
                    : ''
                }
              </div>
              <p class="text-xs ui-ink-muted mb-3">${sp.tagline}</p>
              <ul class="space-y-1 text-xs ui-ink-moss mb-4">
                ${sp.bonuses.map(b => `<li>✦ ${b}</li>`).join('')}
              </ul>
            </div>
            <button data-spec-id="${sp.id}" class="w-full py-2 rounded-xl text-xs font-bold cursor-pointer ${
          active
            ? 'ui-fill-inset ui-ink-muted'
            : 'ui-fill-honey ui-hover-honey ui-ink'
        }">
              ${active ? 'Especialização Ativa' : 'Escolher Build'}
            </button>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('[data-spec-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const specId = btn.getAttribute('data-spec-id') as SpecializationId;
          this.progressionSystem.selectSpecialization(state, specId);
          this.render(state, player);
        });
      });
      return;
    }

    const filtered = UPGRADES_DEF.filter(u => u.category === this.activeUpgradeTab);
    const canControlMachines = this.machineSystem.hasProductionControls(state);
    listEl.innerHTML = filtered.map(u => {
      const cur = state.upgrades[u.id] || 0;
      const isMax = cur >= u.maxLevel;
      const reqLocked = this.upgradeSystem.missingBuild(state, u);
      const requiredName = BLUEPRINTS_DEF.find(bp => bp.id === reqLocked)?.name.split(':')[0];
      const cost = isMax ? null : u.costs[cur];
      const affordable = !reqLocked && cost && this.inventorySystem.canAfford(state, player, cost);

      const costHtml = isMax
        ? '<span class="ui-ink-moss font-semibold text-xs">Nível Máximo ✓</span>'
        : reqLocked
        ? `<span class="ui-ink-honey text-xs">Requer: ${requiredName ?? 'construção concluída'}</span>`
        : cost
        ? Object.entries(cost).map(([resKey, amt]) => {
            const res = resKey as ResourceId;
            const have = this.inventorySystem.getTotalResource(state, player, res);
            const ok = have >= (amt || 0);
            return `<span data-upgrade-resource data-resource="${res}" data-required="${amt || 0}" class="px-2 py-0.5 rounded-lg text-[11px] font-medium ${
              ok
                ? 'ui-fill-moss ui-ink-moss border ui-edge-moss'
                : 'ui-fill-clay ui-ink-clay border ui-edge-clay'
            }">${resourceIcon(res)} <span data-resource-have>${have}</span>/${amt}</span>`;
          }).join(' ')
        : '';

      return `
        <div class="rounded-2xl p-4 ui-fill-light border ui-edge flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-sm font-bold ui-ink-honey">${u.name}</h3>
              <span class="px-2 py-0.5 rounded-md ui-fill-light text-[11px] font-semibold ui-ink">Nv. ${cur}/${u.maxLevel}</span>
            </div>
            <p class="text-xs ui-ink-muted mt-1 leading-relaxed">${u.desc}</p>
            ${!isMax ? `<div class="mt-2 text-[11px] font-semibold ui-ink-sky">${u.effectText(cur)}</div>` : ''}
          </div>
          ${u.id === 'autoMachines' && canControlMachines ? this.renderMachineControls(state) : ''}
          <div class="pt-2 border-t ui-edge flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap gap-1.5">${costHtml}</div>
            ${
              !isMax && !reqLocked
                ? `
              <button data-buy-upg="${u.id}" ${!affordable ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    affordable
                      ? 'ui-fill-honey ui-hover-honey ui-ink cursor-pointer active:scale-95'
                      : 'ui-fill-inset ui-ink-muted cursor-not-allowed'
                  }">Melhorar</button>
            `
                : ''
            }
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-buy-upg]').forEach(btn => {
      btn.addEventListener('click', () => {
        const upgId = btn.getAttribute('data-buy-upg')!;
        this.upgradeSystem.buyUpgrade(state, player, upgId);
        this.render(state, player);
      });
    });

    for (const { id } of machineRecipes) {
      const button = listEl.querySelector<HTMLButtonElement>(`[data-machine-switch="${id}"]`);
      const form = listEl.querySelector<HTMLFormElement>(`[data-machine-batch="${id}"]`);
      const quantity = form?.querySelector<HTMLInputElement>('input');
      button?.addEventListener('click', () => {
        const paused = state.machines[id]?.paused !== true;
        if (!this.machineSystem.setPaused(state, id, paused)) return;

        button.setAttribute('aria-checked', String(!paused));
        const status = button.querySelector('[data-machine-status]');
        if (status) status.textContent = paused ? 'Automático desligado' : 'Automático ligado';
        if (form) form.hidden = !paused;
        this.refreshBatchStatus(listEl, state, id);
      });
      form?.addEventListener('submit', event => {
        event.preventDefault();
        if (!quantity || !this.machineSystem.setBatch(state, id, quantity.valueAsNumber)) return;
        quantity.value = '';
        this.refreshBatchStatus(listEl, state, id);
      });
      form?.querySelector('[data-cancel-batch]')?.addEventListener('click', () => {
        if (!this.machineSystem.setBatch(state, id, 0)) return;
        quantity?.focus();
        this.refreshBatchStatus(listEl, state, id);
      });
    }
  }

  private renderMachineControls(state: GameState): string {
    return `
      <div class="machine-controls" role="group" aria-labelledby="machineControlsTitle">
        <h4 id="machineControlsTitle">Produção por máquina</h4>
        <p>Desligue o automático para produzir somente a quantidade pedida.</p>
        ${machineRecipes.map(({ id, name, outputResource }) => {
          const built = state.builds[id]?.built && state.machines[id];
          const enabled = Boolean(built && state.machines[id].paused !== true);
          const status = !built ? 'Por construir' : enabled ? 'Automático ligado' : 'Automático desligado';
          const remaining = built ? state.machines[id].batchRemaining ?? 0 : 0;
          return `
            <button type="button" role="switch" aria-labelledby="machine-name-${id}" aria-checked="${enabled}"
              data-machine-switch="${id}" class="machine-switch" ${built ? '' : 'disabled'}>
              <span class="machine-switch-info">
                <span id="machine-name-${id}">${name}</span>
                <small data-machine-status>${status}</small>
              </span>
              <span class="machine-switch-track" aria-hidden="true"></span>
            </button>
            ${built ? `
              <form data-machine-batch="${id}" class="machine-batch" ${enabled ? 'hidden' : ''}>
                <label for="batch-quantity-${id}">Quantidade · <span aria-hidden="true">${resourceIcon(outputResource, true)}</span> ${MACHINE_RECIPES[id].floatText}</label>
                <div class="machine-batch-actions">
                  <input id="batch-quantity-${id}" type="number" min="1" max="${Number.MAX_SAFE_INTEGER}" step="1" required inputmode="numeric" class="vale-input">
                  <button class="ui-fill-moss ui-hover-moss" type="submit">Produzir</button>
                  <button class="ui-fill-inset" type="button" data-cancel-batch ${remaining ? '' : 'hidden'}>Cancelar</button>
                </div>
                <p role="status" data-batch-status>${remaining ? `Restam ${remaining} un. no pedido` : ''}</p>
              </form>
            ` : ''}
          `;
        }).join('')}
      </div>
    `;
  }

  private refreshBatchStatus(list: HTMLElement, state: GameState, id: MachineId): void {
    const form = list.querySelector<HTMLFormElement>(`[data-machine-batch="${id}"]`);
    if (!form) return;
    const remaining = state.machines[id]?.batchRemaining ?? 0;
    const status = form.querySelector('[data-batch-status]');
    const message = remaining ? `Restam ${remaining} un. no pedido` : '';
    if (status && status.textContent !== message) status.textContent = message;
    form.querySelector('[data-cancel-batch]')?.toggleAttribute('hidden', remaining === 0);
  }

  /**
   * Atualiza apenas os valores que mudam durante a simulação.
   * Evita reconstruir os cards e perder foco/estado de interação a cada tick.
   */
  refreshResources(state: GameState, player: PlayerState): void {
    const listEl = document.getElementById('upgradeList');
    if (!listEl || this.activeUpgradeTab === 'specialization') return;

    if (this.activeUpgradeTab === 'automation') {
      for (const { id } of machineRecipes) this.refreshBatchStatus(listEl, state, id);
    }

    listEl.querySelectorAll<HTMLElement>('[data-upgrade-resource]').forEach(chip => {
      const resource = chip.dataset.resource as ResourceId | undefined;
      if (!resource) return;

      const required = Number(chip.dataset.required || 0);
      const have = this.inventorySystem.getTotalResource(state, player, resource);
      const amountEl = chip.querySelector<HTMLElement>('[data-resource-have]');
      if (amountEl) amountEl.textContent = String(have);

      const affordable = have >= required;
      chip.classList.toggle('ui-fill-moss', affordable);
      chip.classList.toggle('ui-ink-moss', affordable);
      chip.classList.toggle('ui-edge-moss', affordable);
      chip.classList.toggle('ui-fill-clay', !affordable);
      chip.classList.toggle('ui-ink-clay', !affordable);
      chip.classList.toggle('ui-edge-clay', !affordable);
    });

    listEl.querySelectorAll<HTMLButtonElement>('[data-buy-upg]').forEach(button => {
      const upgradeId = button.dataset.buyUpg;
      if (!upgradeId) return;

      const affordable = this.upgradeSystem.canBuy(state, player, upgradeId);
      button.disabled = !affordable;
      button.classList.toggle('ui-fill-honey', affordable);
      button.classList.toggle('ui-hover-honey', affordable);
      button.classList.toggle('ui-ink', affordable);
      button.classList.toggle('cursor-pointer', affordable);
      button.classList.toggle('ui-fill-inset', !affordable);
      button.classList.toggle('ui-ink-muted', !affordable);
      button.classList.toggle('cursor-not-allowed', !affordable);
    });
  }
}
