import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { InventorySystem } from '../../src/gameplay/InventorySystem.ts';
import { BuildingSystem } from '../../src/gameplay/BuildingSystem.ts';

describe('BuildingSystem', () => {
  it('aceita depósitos parciais e conclui a construção quando o custo é quitado', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new BuildingSystem(new InventorySystem(), new EventBus());

    player.backpack = ['wood', 'wood', 'wood', 'wood'];
    const partial = system.interactWithBlueprint('sawmill', state, player);

    expect(partial).toEqual({ success: true, completed: false, depositedAny: true });
    expect(state.builds.sawmill.paid.wood).toBe(4);
    expect(state.builds.sawmill.built).toBe(false);
    expect(player.backpack).toHaveLength(0);

    state.storage.wood = 2;
    const completed = system.interactWithBlueprint('sawmill', state, player);

    expect(completed).toEqual({ success: true, completed: true, depositedAny: true });
    expect(state.builds.sawmill.built).toBe(true);
    expect(state.builds.sawmill.paid.wood).toBe(6);
    expect(state.trackedBuildId).toBe('eastBridge');
    expect(state.storage.wood).toBe(0);
  });

  it('avança a fase ao concluir uma ponte com os materiais exigidos', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new BuildingSystem(new InventorySystem(), new EventBus());

    state.storage.planks = 10;
    state.storage.stone = 8;
    state.storage.coins = 35;

    const result = system.interactWithBlueprint('eastBridge', state, player);

    expect(result.completed).toBe(true);
    expect(state.builds.eastBridge.built).toBe(true);
    expect(state.phase).toBe(2);
    expect(state.trackedBuildId).toBe('furnace');
    expect(state.storage.planks).toBe(0);
    expect(state.storage.stone).toBe(0);
    expect(state.storage.coins).toBe(0);
  });

  it('não altera recursos quando o blueprint não existe ou já foi construído', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new BuildingSystem(new InventorySystem(), new EventBus());

    player.backpack = ['wood'];
    expect(system.interactWithBlueprint('not-a-building', state, player).success).toBe(false);

    state.builds.sawmill.built = true;
    expect(system.interactWithBlueprint('sawmill', state, player).success).toBe(false);
    expect(player.backpack).toEqual(['wood']);
  });
});
