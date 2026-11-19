export class InventorySystem {
  getTotalResource(state, player, resId) {
    if (resId === 'coins' || resId === 'blueprints' || resId === 'relic') {
      return state.storage[resId] || 0;
    }
    const inBackpack = player.backpack.filter(r => r === resId).length;
    return (state.storage[resId] || 0) + inBackpack;
  }

  consumeResource(state, player, resId, amount) {
    if (this.getTotalResource(state, player, resId) < amount) {
      return false;
    }

    let remaining = amount;

    for (let i = player.backpack.length - 1; i >= 0 && remaining > 0; i--) {
      if (player.backpack[i] === resId) {
        player.backpack.splice(i, 1);
        remaining--;
      }
    }

    if (remaining > 0) {
      state.storage[resId] = Math.max(0, (state.storage[resId] || 0) - remaining);
    }

    return true;
  }

  canAfford(state, player, cost) {
    for (const [res, amt] of Object.entries(cost)) {
      if (this.getTotalResource(state, player, res) < (amt || 0)) {
        return false;
      }
    }
    return true;
  }

  spendCost(state, player, cost) {
    if (!this.canAfford(state, player, cost)) {
      return false;
    }
    for (const [res, amt] of Object.entries(cost)) {
      this.consumeResource(state, player, res, amt || 0);
    }
    return true;
  }

  addToBackpack(player, resId, maxCapacity) {
    if (player.backpack.length >= maxCapacity) {
      return false;
    }
    player.backpack.push(resId);
    return true;
  }

  unloadOneToStorage(state, player) {
    if (player.backpack.length === 0) return null;
    const res = player.backpack.pop();
    state.storage[res] = (state.storage[res] || 0) + 1;
    state.stats.totalHarvested++;
    return res;
  }
}
