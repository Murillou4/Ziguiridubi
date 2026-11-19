import { describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { getDerivedStats } from '../../src/domain/Stats.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { InventorySystem } from '../../src/gameplay/InventorySystem.ts';
import { ContractSystem } from '../../src/gameplay/ContractSystem.ts';

describe('ContractSystem', () => {
  it('paga um contrato, consome os materiais e repõe a lista', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new ContractSystem(new InventorySystem(), new EventBus());

    state.contracts = [
      { id: 'target', title: 'Contrato de Teste', req: { wood: 2 }, coins: 30, blueprints: 1 },
      { id: 'keep-a', title: 'Contrato A', req: { stone: 1 }, coins: 10, blueprints: 1 },
      { id: 'keep-b', title: 'Contrato B', req: { planks: 1 }, coins: 10, blueprints: 1 }
    ];
    state.storage.wood = 1;
    player.backpack = ['wood'];

    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const result = system.completeContract(state, player, 'target', getDerivedStats(state));

    expect(result).toEqual({ success: true, coins: 30, blueprints: 1 });
    expect(state.storage.wood).toBe(0);
    expect(player.backpack).toHaveLength(0);
    expect(state.storage.coins).toBe(45);
    expect(state.storage.blueprints).toBe(1);
    expect(state.stats.coinsEarned).toBe(30);
    expect(state.contracts).toHaveLength(3);
    expect(state.contracts.some(contract => contract.id === 'target')).toBe(false);
    expect(state.contracts.some(contract => contract.id === 'keep-a')).toBe(true);
    expect(state.contracts.some(contract => contract.id === 'keep-b')).toBe(true);
  });

  it('não conclui contrato sem recursos suficientes', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new ContractSystem(new InventorySystem(), new EventBus());

    state.contracts = [
      { id: 'target', title: 'Contrato de Teste', req: { wood: 3 }, coins: 30, blueprints: 1 }
    ];
    state.storage.wood = 2;

    const result = system.completeContract(state, player, 'target', getDerivedStats(state));

    expect(result.success).toBe(false);
    expect(state.storage.wood).toBe(2);
    expect(state.storage.coins).toBe(15);
    expect(state.contracts).toHaveLength(1);
  });
});
