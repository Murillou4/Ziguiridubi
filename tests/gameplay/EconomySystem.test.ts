import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { getDerivedStats } from '../../src/domain/Stats.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { InventorySystem } from '../../src/gameplay/InventorySystem.ts';
import { EconomySystem } from '../../src/gameplay/EconomySystem.ts';

describe('EconomySystem', () => {
  it('vende uma unidade combinando mochila e armazém', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new EconomySystem(new InventorySystem(), new EventBus());

    state.storage.wood = 2;
    player.backpack = ['wood', 'wood'];

    const result = system.sellDirectResource(state, player, 'wood', 'one', getDerivedStats(state));

    expect(result).toEqual({ qty: 1, coinsGained: 2 });
    expect(state.storage.coins).toBe(17);
    expect(state.stats.coinsEarned).toBe(2);
    expect(player.backpack).toHaveLength(1);
    expect(state.storage.wood).toBe(2);
  });

  it('vende somente os excedentes e preserva cinco unidades por recurso', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new EconomySystem(new InventorySystem(), new EventBus());

    state.storage.wood = 8;
    state.storage.stone = 4;

    const result = system.sellAllSurplus(state, player, getDerivedStats(state));

    expect(result).toEqual({ totalCoins: 6, totalSold: 3 });
    expect(state.storage.wood).toBe(5);
    expect(state.storage.stone).toBe(4);
    expect(state.storage.coins).toBe(21);
  });

  it('não vende recursos sem preço comercial', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new EconomySystem(new InventorySystem(), new EventBus());

    state.storage.relic = 4;
    const result = system.sellDirectResource(state, player, 'relic', 'all', getDerivedStats(state));

    expect(result).toEqual({ qty: 0, coinsGained: 0 });
    expect(state.storage.relic).toBe(4);
    expect(state.storage.coins).toBe(15);
  });
});
