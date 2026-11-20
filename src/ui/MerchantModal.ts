import { DerivedStats, GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { RESOURCES } from '../config/resources.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { EconomySystem, getSaleValue, SURPLUS_RESERVE } from '../gameplay/EconomySystem.ts';
import { ContractSystem } from '../gameplay/ContractSystem.ts';
import { resourceIcon } from './resource-icon.ts';

type MerchantTab = 'sell' | 'contracts';

const SELLABLE = Object.values(RESOURCES).filter(resource => resource.sellPrice > 0);
const numberFormat = new Intl.NumberFormat('pt-BR');

function escapeHtml(value: string): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export class MerchantModal {
  private activeTab: MerchantTab = 'sell';
  private showEmptyStock = false;
  private renderedState = '';

  constructor(
    private inventorySystem: InventorySystem,
    private economySystem: EconomySystem,
    private contractSystem: ContractSystem
  ) {}

  init(
    getState: () => GameState,
    getPlayer: () => PlayerState,
    getStats: () => DerivedStats
  ): void {
    const render = () => this.render(getState(), getPlayer(), getStats());
    const tabs = document.querySelectorAll<HTMLButtonElement>('#merchantTabs [role="tab"]');

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        this.activeTab = index === 0 ? 'sell' : 'contracts';
        const content = document.getElementById('merchantContent');
        if (content) content.scrollTop = 0;
        render();
      });

      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[1] : tabs[1 - index];
        next.click();
        next.focus();
      });
    });

    document.getElementById('btnMerchantStockFilter')?.addEventListener('click', () => {
      this.showEmptyStock = !this.showEmptyStock;
      render();
    });

    document.getElementById('btnSellSurplus')?.addEventListener('click', () => {
      this.economySystem.sellAllSurplus(getState(), getPlayer(), getStats());
      render();
    });

    document.getElementById('merchantSellList')?.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-sell-res]');
      const mode = button?.dataset.sellMode;
      if (!button || button.disabled || (mode !== 'one' && mode !== 'all')) return;
      const resource = button.dataset.sellRes as ResourceId;
      this.economySystem.sellDirectResource(getState(), getPlayer(), resource, mode, getStats());
      render();
    });

    document.getElementById('merchantContractsList')?.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-ct-id]');
      const contract = button?.dataset.ctId;
      if (!contract || button.disabled) return;
      this.contractSystem.completeContract(getState(), getPlayer(), contract, getStats());
      render();
    });

    document.getElementById('merchantWallet')?.insertAdjacentHTML('afterbegin', resourceIcon('coins', true));
    const reserveNote = document.getElementById('merchantReserveNote');
    if (reserveNote) reserveNote.textContent = `Guarda ${SURPLUS_RESERVE} de cada material.`;
  }

  render(state: GameState, player: PlayerState, stats: DerivedStats): void {
    const signature = JSON.stringify([
      this.activeTab, this.showEmptyStock, state.storage, player.backpack, state.contracts, stats.merchantMult
    ]);
    if (signature === this.renderedState) return;
    this.renderedState = signature;

    const coins = document.getElementById('merchantCoinsDisplay');
    if (coins) coins.textContent = numberFormat.format(state.storage.coins || 0);

    const selling = this.activeTab === 'sell';
    const sellTab = document.getElementById('merchantSellTab');
    const contractsTab = document.getElementById('merchantContractsTab');
    sellTab?.setAttribute('aria-selected', String(selling));
    contractsTab?.setAttribute('aria-selected', String(!selling));
    sellTab?.setAttribute('tabindex', selling ? '0' : '-1');
    contractsTab?.setAttribute('tabindex', selling ? '-1' : '0');
    document.getElementById('merchantSellView')?.toggleAttribute('hidden', !selling);
    document.getElementById('merchantContractsView')?.toggleAttribute('hidden', selling);

    const list = document.getElementById(selling ? 'merchantSellList' : 'merchantContractsList');
    if (!list) return;
    const focused = document.activeElement;
    const focusKey = focused instanceof HTMLButtonElement && list.contains(focused)
      ? focused.dataset.merchantAction
      : undefined;

    list.innerHTML = selling ? this.renderSales(state, player, stats) : this.renderContracts(state, player, stats);

    if (focusKey) {
      const replacement = [...list.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        .find(button => button.dataset.merchantAction === focusKey);
      (replacement ?? (selling ? sellTab : contractsTab))?.focus({ preventScroll: true });
    }
  }

  private renderSales(state: GameState, player: PlayerState, stats: DerivedStats): string {
    const stock = SELLABLE.map(resource => ({
      resource,
      have: this.inventorySystem.getTotalResource(state, player, resource.id)
    }));
    const shown = stock.filter(item => this.showEmptyStock || item.have > 0);
    const filter = document.getElementById('btnMerchantStockFilter');
    filter?.setAttribute('aria-pressed', String(this.showEmptyStock));
    if (filter) filter.textContent = this.showEmptyStock ? 'Só em estoque' : 'Mostrar sem estoque';

    const surplus = stock.reduce((total, { resource, have }) =>
      total + getSaleValue(Math.max(0, have - SURPLUS_RESERVE), resource.sellPrice, stats.merchantMult), 0);
    const sellSurplus = document.getElementById('btnSellSurplus') as HTMLButtonElement | null;
    if (sellSurplus) sellSurplus.disabled = surplus <= 0;
    const surplusCoins = document.getElementById('merchantSurplusCoins');
    if (surplusCoins) surplusCoins.innerHTML = surplus > 0 ? `${resourceIcon('coins')} +${numberFormat.format(surplus)}` : '';

    if (!shown.length) return '<p class="merchant-empty">Seu estoque está vazio. Colete materiais para vender.</p>';

    return shown.map(({ resource, have }) => {
      const unit = Math.max(1, getSaleValue(1, resource.sellPrice, stats.merchantMult));
      const total = Math.max(1, getSaleValue(have, resource.sellPrice, stats.merchantMult));
      return `
        <article class="merchant-sale">
          <div class="merchant-item">
            <span class="merchant-item-icon">${resourceIcon(resource.id, true)}</span>
            <div><h4>${resource.name}</h4><p>${numberFormat.format(have)} em estoque · ${unit} moedas/un.</p></div>
          </div>
          ${have > 0 ? `
            <div class="merchant-sale-actions">
              <button type="button" class="merchant-action ui-fill-sand ui-hover-sand" data-sell-res="${resource.id}" data-sell-mode="one" data-merchant-action="${resource.id}-one" aria-label="Vender 1 unidade de ${resource.name}">
                Vender 1
              </button>
              <button type="button" class="merchant-action ui-fill-honey ui-hover-honey" data-sell-res="${resource.id}" data-sell-mode="all" data-merchant-action="${resource.id}-all" aria-label="Vender todo o estoque de ${resource.name} por ${numberFormat.format(total)} moedas">
                Vender tudo <span>${resourceIcon('coins', true)} +${numberFormat.format(total)}</span>
              </button>
            </div>
          ` : '<span class="merchant-no-stock">Sem estoque</span>'}
        </article>
      `;
    }).join('');
  }

  private renderContracts(state: GameState, player: PlayerState, stats: DerivedStats): string {
    return state.contracts.map(contract => {
      const ready = this.inventorySystem.canAfford(state, player, contract.req);
      const reward = numberFormat.format(Math.round(contract.coins * stats.merchantMult));
      const requirements = Object.entries(contract.req).map(([key, required]) => {
        const resource = key as ResourceId;
        const def = RESOURCES[resource];
        if (!def) return '';
        const have = Math.min(required, this.inventorySystem.getTotalResource(state, player, resource));
        const missing = required - have;
        return `
          <li>
            <span>${resourceIcon(resource, true)} ${def.name}</span>
            <span class="merchant-requirement-count">${numberFormat.format(have)}/${numberFormat.format(required)}</span>
            <span class="${missing ? 'ui-ink-honey' : 'ui-ink-moss'}">${missing ? `Faltam ${missing}` : 'Completo'}</span>
          </li>
        `;
      }).join('');
      const id = escapeHtml(contract.id);

      return `
        <article class="merchant-contract">
          <div class="merchant-contract-header">
            <h3>${escapeHtml(contract.title)}</h3>
            <div class="merchant-reward" aria-label="Recompensa">
              <span>${resourceIcon('coins')} +${reward}</span>
              <span>${resourceIcon('blueprints')} +${numberFormat.format(contract.blueprints)}</span>
            </div>
          </div>
          <ul class="merchant-requirements" aria-label="Materiais do contrato">${requirements}</ul>
          ${ready ? `<button type="button" class="merchant-action ui-fill-moss ui-hover-moss" data-ct-id="${id}" data-merchant-action="contract-${id}">Entregar contrato</button>` : ''}
        </article>
      `;
    }).join('') || '<p class="merchant-empty">Nenhum contrato disponível.</p>';
  }
}
