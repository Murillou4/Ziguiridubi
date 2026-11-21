import { DerivedStats, GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { RESOURCES, SELLABLE_RESOURCES } from '../config/resources.ts';
import { InventorySystem } from './InventorySystem.ts';
import { EventBus } from '../core/EventBus.ts';

const DEFAULT_SURPLUS_RESERVE = 5;

export function getSurplusReserve(state: GameState, id: ResourceId): number {
  return state.surplusReserves[id] ?? DEFAULT_SURPLUS_RESERVE;
}

export function getSaleValue(quantity: number, unitPrice: number, multiplier: number): number {
  return Math.round(quantity * unitPrice * multiplier);
}

export class EconomySystem {
  constructor(
    private inventorySystem: InventorySystem,
    private eventBus: EventBus
  ) {}

  setSurplusReserve(state: GameState, id: ResourceId, reserve: number): boolean {
    if (!(RESOURCES[id]?.sellPrice > 0) || !Number.isSafeInteger(reserve) || reserve < 0) return false;
    if (getSurplusReserve(state, id) === reserve) return false;

    state.surplusReserves[id] = reserve;
    this.eventBus.emit('save:request', { silent: true });
    return true;
  }

  sellDirectResource(
    state: GameState,
    player: PlayerState,
    resId: ResourceId,
    mode: 'one' | 'all',
    stats: DerivedStats
  ): { qty: number; coinsGained: number } {
    const def = RESOURCES[resId];
    if (!def || def.sellPrice <= 0) return { qty: 0, coinsGained: 0 };

    const totalHave = this.inventorySystem.getTotalResource(state, player, resId);
    let qty = 0;
    if (mode === 'one') qty = Math.min(1, totalHave);
    else if (mode === 'all') qty = totalHave;

    if (qty <= 0) return { qty: 0, coinsGained: 0 };

    const coinsGained = Math.max(1, getSaleValue(qty, def.sellPrice, stats.merchantMult));

    this.inventorySystem.consumeResource(state, player, resId, qty);
    state.storage.coins = (state.storage.coins || 0) + coinsGained;
    state.stats.coinsEarned += coinsGained;

    this.eventBus.emit('sound:coins');
    this.eventBus.emit('ui:hud');

    return { qty, coinsGained };
  }

  sellAllSurplus(
    state: GameState,
    player: PlayerState,
    stats: DerivedStats
  ): { totalCoins: number; totalSold: number } {
    let totalCoins = 0;
    let totalSold = 0;

    for (const resource of SELLABLE_RESOURCES) {
      const have = this.inventorySystem.getTotalResource(state, player, resource.id);
      const surplus = have - getSurplusReserve(state, resource.id);
      if (surplus <= 0) continue;
      this.inventorySystem.consumeResource(state, player, resource.id, surplus);
      totalCoins += getSaleValue(surplus, resource.sellPrice, stats.merchantMult);
      totalSold += surplus;
    }

    if (totalCoins > 0) {
      state.storage.coins = (state.storage.coins || 0) + totalCoins;
      state.stats.coinsEarned += totalCoins;
      this.eventBus.emit('sound:coins');
      this.eventBus.emit('ui:toast', {
        message: `🪙 Excedentes vendidos por +${totalCoins} Moedas!`
      });
      this.eventBus.emit('ui:hud');
    } else {
      this.eventBus.emit('ui:toast', {
        message: 'ℹ️ Nenhum material está acima da reserva configurada.'
      });
    }

    return { totalCoins, totalSold };
  }
}
