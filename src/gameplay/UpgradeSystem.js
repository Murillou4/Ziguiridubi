import { UPGRADES_DEF } from '../config/upgrades.js';

export class UpgradeSystem {
  constructor(inventorySystem, eventBus) {
    this.inventorySystem = inventorySystem;
    this.eventBus = eventBus;
    this.upgrades = UPGRADES_DEF;
  }

  canBuy(state, player, upgradeId) {
    const def = this.upgrades.find(u => u.id === upgradeId);
    if (!def) return false;
    const cur = state.upgrades[upgradeId] || 0;
    if (cur >= def.maxLevel) return false;
    if (def.requiresBuild && !state.builds[def.requiresBuild]?.built) return false;

    const cost = def.costs[cur];
    return this.inventorySystem.canAfford(state, player, cost);
  }

  buyUpgrade(state, player, upgradeId) {
    const def = this.upgrades.find(u => u.id === upgradeId);
    if (!def) return false;

    const cur = state.upgrades[upgradeId] || 0;
    if (cur >= def.maxLevel) return false;
    if (def.requiresBuild && !state.builds[def.requiresBuild]?.built) return false;

    const cost = def.costs[cur];
    if (!this.inventorySystem.canAfford(state, player, cost)) return false;

    this.inventorySystem.spendCost(state, player, cost);
    state.upgrades[upgradeId] = cur + 1;

    this.eventBus.emit('sound:upgrade');
    this.eventBus.emit('upgrade:purchased', { id: upgradeId, level: state.upgrades[upgradeId] });
    this.eventBus.emit('ui:toast', { message: `✨ Melhoria adquirida: ${def.name}` });
    this.eventBus.emit('save:request', { silent: false });
    this.eventBus.emit('ui:refresh');

    return true;
  }
}
