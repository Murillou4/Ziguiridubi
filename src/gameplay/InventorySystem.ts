import { GameState, PlayerState, ResourceId, CostMap } from '../domain/types.ts';

export class InventorySystem {
  /**
   * Retorna a quantidade total de um recurso (Armazém + Mochila Física)
   */
  getTotalResource(state: GameState, player: PlayerState, resId: ResourceId): number {
    if (resId === 'coins' || resId === 'blueprints' || resId === 'relic') {
      return state.storage[resId] || 0;
    }
    const inBackpack = player.backpack.filter(r => r === resId).length;
    return (state.storage[resId] || 0) + inBackpack;
  }

  /**
   * Consome a quantidade especificada de um recurso.
   * Prioriza retirar primeiro da mochila física (sensação tátil), e depois do armazém.
   */
  consumeResource(state: GameState, player: PlayerState, resId: ResourceId, amount: number): boolean {
    if (this.getTotalResource(state, player, resId) < amount) {
      return false;
    }

    let remaining = amount;

    // 1. Remove da mochila física (de trás para frente)
    for (let i = player.backpack.length - 1; i >= 0 && remaining > 0; i--) {
      if (player.backpack[i] === resId) {
        player.backpack.splice(i, 1);
        remaining--;
      }
    }

    // 2. Remove o restante do armazém
    if (remaining > 0) {
      state.storage[resId] = Math.max(0, (state.storage[resId] || 0) - remaining);
    }

    return true;
  }

  /**
   * Verifica se o jogador possui todos os recursos para pagar um determinado custo.
   */
  canAfford(state: GameState, player: PlayerState, cost: CostMap): boolean {
    for (const [res, amt] of Object.entries(cost) as [ResourceId, number][]) {
      if (this.getTotalResource(state, player, res) < (amt || 0)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Gasta o custo especificado consumindo primeiro da mochila e depois do armazém.
   */
  spendCost(state: GameState, player: PlayerState, cost: CostMap): boolean {
    if (!this.canAfford(state, player, cost)) {
      return false;
    }
    for (const [res, amt] of Object.entries(cost) as [ResourceId, number][]) {
      this.consumeResource(state, player, res, amt || 0);
    }
    return true;
  }

  /**
   * Tenta adicionar um recurso físico na mochila se houver capacidade.
   */
  addToBackpack(player: PlayerState, resId: ResourceId, maxCapacity: number): boolean {
    if (player.backpack.length >= maxCapacity) {
      return false;
    }
    player.backpack.push(resId);
    return true;
  }

  /**
   * Descarrega o último item da mochila física no armazém central.
   */
  unloadOneToStorage(state: GameState, player: PlayerState): ResourceId | null {
    if (player.backpack.length === 0) return null;
    const res = player.backpack.pop()!;
    state.storage[res] = (state.storage[res] || 0) + 1;
    state.stats.totalHarvested++;
    return res;
  }
}
