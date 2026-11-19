import { RESOURCES } from '../config/resources.js';

export class EconomySystem {
  constructor(inventorySystem, eventBus) {
    this.inventorySystem = inventorySystem;
    this.eventBus = eventBus;
  }

  sellDirectResource(state, player, resId, mode, stats) {
    const def = RESOURCES[resId];
    if (!def || def.sellPrice <= 0) return { qty: 0, coinsGained: 0 };

    const totalHave = this.inventorySystem.getTotalResource(state, player, resId);
    let qty = 0;
    if (mode === 'one') qty = Math.min(1, totalHave);
    else if (mode === 'all') qty = totalHave;

    if (qty <= 0) return { qty: 0, coinsGained: 0 };

    const coinsGained = Math.max(1, Math.round(qty * def.sellPrice * stats.merchantMult));

    this.inventorySystem.consumeResource(state, player, resId, qty);
    state.storage.coins = (state.storage.coins || 0) + coinsGained;
    state.stats.coinsEarned += coinsGained;

    this.eventBus.emit('sound:coins');
    this.eventBus.emit('ui:hud');

    return { qty, coinsGained };
  }

  sellAllSurplus(state, player, stats) {
    let totalCoins = 0;
    let totalSold = 0;

    Object.values(RESOURCES).forEach(r => {
      if (r.sellPrice > 0) {
        const have = this.inventorySystem.getTotalResource(state, player, r.id);
        const surplus = Math.max(0, have - 5);
        if (surplus > 0) {
          this.inventorySystem.consumeResource(state, player, r.id, surplus);
          const gained = Math.round(surplus * r.sellPrice * stats.merchantMult);
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
