import { DerivedStats, GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { RESOURCES } from '../config/resources.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { EconomySystem } from '../gameplay/EconomySystem.ts';
import { ContractSystem } from '../gameplay/ContractSystem.ts';

export class MerchantModal {
  constructor(
    private inventorySystem: InventorySystem,
    private economySystem: EconomySystem,
    private contractSystem: ContractSystem
  ) {}

  render(state: GameState, player: PlayerState, stats: DerivedStats): void {
    const coinsDisplay = document.getElementById('merchantCoinsDisplay');
    if (coinsDisplay) coinsDisplay.textContent = String(state.storage.coins || 0);

    // 1. Venda Direta
    const sellList = document.getElementById('merchantSellList');
    if (sellList) {
      const sellable = (Object.values(RESOURCES) as typeof RESOURCES[ResourceId][]).filter(
        r => r.sellPrice > 0
      );

      sellList.innerHTML = sellable.map(r => {
        const have = this.inventorySystem.getTotalResource(state, player, r.id);
        const unitPrice = Math.max(1, Math.round(r.sellPrice * stats.merchantMult));
        const allPrice = have * unitPrice;
        return `
          <div class="rounded-2xl p-3 bg-black/30 border border-stone-800 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <span class="text-xl">${r.icon}</span>
              <div>
                <div class="text-xs font-bold text-stone-100">${r.name} <span class="text-stone-400 font-normal">(${have} em posse)</span></div>
                <div class="text-[11px] text-amber-300 font-semibold">${unitPrice}  / unidade</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <button data-sell-res="${r.id}" data-sell-mode="one" ${have < 1 ? 'disabled' : ''} class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                have >= 1
                  ? 'bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 border border-amber-400/30 cursor-pointer'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
              }">Vender 1</button>
              <button data-sell-res="${r.id}" data-sell-mode="all" ${have < 1 ? 'disabled' : ''} class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                have >= 1
                  ? 'bg-amber-400 hover:bg-amber-300 text-stone-950 cursor-pointer'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
              }">Tudo (${allPrice} )</button>
            </div>
          </div>
        `;
      }).join('');

      sellList.querySelectorAll('[data-sell-res]').forEach(btn => {
        btn.addEventListener('click', () => {
          const resId = btn.getAttribute('data-sell-res') as ResourceId;
          const mode = btn.getAttribute('data-sell-mode') as 'one' | 'all';
          this.economySystem.sellDirectResource(state, player, resId, mode, stats);
          this.render(state, player, stats);
        });
      });
    }

    // 2. Contratos do Vale
    const ctList = document.getElementById('merchantContractsList');
    if (ctList) {
      ctList.innerHTML = state.contracts.map(ct => {
        const ready = this.inventorySystem.canAfford(state, player, ct.req);
        const rewardCoins = Math.round(ct.coins * stats.merchantMult);
        const reqTags = Object.entries(ct.req).map(([resKey, amt]) => {
          const res = resKey as ResourceId;
          const def = RESOURCES[res];
          const have = this.inventorySystem.getTotalResource(state, player, res);
          const ok = have >= (amt || 0);
          return `<span class="px-2 py-0.5 rounded-lg text-xs font-medium ${
            ok
              ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/30'
              : 'bg-stone-800 text-stone-300'
          }">${def ? def.icon : ''} ${have}/${amt}</span>`;
        }).join(' ');

        return `
          <div class="rounded-2xl p-3.5 bg-black/30 border border-stone-800 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-stone-100">${ct.title}</span>
              <span class="text-xs font-bold text-amber-300">+${rewardCoins}   +${ct.blueprints} </span>
            </div>
            <div class="flex flex-wrap gap-1.5">${reqTags}</div>
            <button data-ct-id="${ct.id}" ${!ready ? 'disabled' : ''} class="w-full py-2 rounded-xl text-xs font-bold transition ${
              ready
                ? 'bg-emerald-400 hover:bg-emerald-300 text-stone-950 cursor-pointer active:scale-95'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
            }">
              ${ready ? 'Entregar Contrato' : 'Recursos Faltando'}
            </button>
          </div>
        `;
      }).join('');

      ctList.querySelectorAll('[data-ct-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const ctId = btn.getAttribute('data-ct-id')!;
          this.contractSystem.completeContract(state, player, ctId, stats);
          this.render(state, player, stats);
        });
      });
    }
  }
}
