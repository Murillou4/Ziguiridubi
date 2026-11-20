import { DerivedStats, GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { RESOURCES } from '../config/resources.ts';
import { InventorySystem } from './InventorySystem.ts';
import { EventBus } from '../core/EventBus.ts';

export const SURPLUS_RESERVE = 5;

export function getSaleValue(quantity: number, unitPrice: number, multiplier: number): number {
  return Math.round(quantity * unitPrice * multiplier);
}

export class EconomySystem {
  constructor(
    private inventorySystem: InventorySystem,
    private eventBus: EventBus
  ) {}

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

    (Object.values(RESOURCES) as typeof RESOURCES[ResourceId][]).forEach(r => {
      if (r.sellPrice > 0) {
        const have = this.inventorySystem.getTotalResource(state, player, r.id);
        const surplus = Math.max(0, have - SURPLUS_RESERVE);
        if (surplus > 0) {
          this.inventorySystem.consumeResource(state, player, r.id, surplus);
          const gained = getSaleValue(surplus, r.sellPrice, stats.merchantMult);
          totalCoins += gained;
          totalSold += surplus;
        }
      }
    });

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
        message: 'ℹ️ Você não possui mais de 5 unidades excedentes no momento.'
      });
    }

    return { totalCoins, totalSold };
  }
}
