import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { InventorySystem } from '../../src/gameplay/InventorySystem.ts';

describe('InventorySystem', () => {
  it('soma corretamente mochila e armazém', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const inventory = new InventorySystem();

    state.storage.wood = 4;
    player.backpack = ['wood', 'stone'];

    expect(inventory.getTotalResource(state, player, 'wood')).toBe(5);
  });

  it('consome primeiro da mochila e depois do armazém', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const inventory = new InventorySystem();

    state.storage.wood = 3;
    player.backpack = ['wood', 'stone'];

    expect(inventory.spendCost(state, player, { wood: 3 })).toBe(true);
    expect(player.backpack).toEqual(['stone']);
    expect(state.storage.wood).toBe(1);
  });

  it('não altera o inventário quando o custo não pode ser pago', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const inventory = new InventorySystem();

    state.storage.wood = 1;
    player.backpack = ['stone'];

    expect(inventory.spendCost(state, player, { wood: 2 })).toBe(false);
    expect(state.storage.wood).toBe(1);
    expect(player.backpack).toEqual(['stone']);
  });

  it('respeita a capacidade da mochila', () => {
    const player = createDefaultPlayer();
    const inventory = new InventorySystem();

    expect(inventory.addToBackpack(player, 'wood', 1)).toBe(true);
    expect(inventory.addToBackpack(player, 'stone', 1)).toBe(false);
    expect(player.backpack).toEqual(['wood']);
  });
});
