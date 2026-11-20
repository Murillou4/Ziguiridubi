import { describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { getDerivedStats } from '../../src/domain/Stats.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { InventorySystem } from '../../src/gameplay/InventorySystem.ts';
import { MachineSystem } from '../../src/gameplay/MachineSystem.ts';
import { BLUEPRINTS_DEF } from '../../src/config/buildings.ts';

describe('MachineSystem', () => {
  it('transforma madeira em tábuas quando o jogador está perto da serraria', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new MachineSystem(new InventorySystem(), new EventBus());

    state.builds.sawmill.built = true;
    state.storage.wood = 4;
    const sawmill = BLUEPRINTS_DEF.find(bp => bp.id === 'sawmill')!;
    player.x = sawmill.x + sawmill.w / 2 + 50;
    player.y = sawmill.y + sawmill.h / 2 - 35;

    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    system.update(state, player, getDerivedStats(state), 2);

    expect(state.storage.wood).toBe(2);
    expect(state.storage.planks).toBe(1);
    expect(state.machines.sawmill.progress).toBe(0);
  });

  it('processa a fornalha e a oficina de engrenagens em cadeia', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new MachineSystem(new InventorySystem(), new EventBus());

    state.builds.furnace.built = true;
    state.builds.gearWorkshop.built = true;
    state.upgrades.autoMachines = 1;
    state.storage.ironOre = 2;
    state.storage.ironIngot = 2;
    state.storage.planks = 2;

    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    system.update(state, player, getDerivedStats(state), 3);

    expect(state.storage.ironOre).toBe(0);
    expect(state.storage.ironIngot).toBe(1);
    expect(state.storage.planks).toBe(0);
    expect(state.storage.gears).toBe(1);
    expect(state.machines.furnace.progress).toBe(0);
    expect(state.machines.gearWorkshop.progress).toBe(0);
  });

  it('não processa receitas de construções ainda não erguidas', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new MachineSystem(new InventorySystem(), new EventBus());

    state.storage.wood = 8;
    system.update(state, player, getDerivedStats(state), 10);

    expect(state.storage.wood).toBe(8);
    expect(state.storage.planks).toBe(0);
    expect(state.machines.sawmill.progress).toBe(0);
  });

  it('permite automação fora do alcance quando autoMachines está comprado', () => {
    const state = createDefaultState();
    const player = createDefaultPlayer();
    const system = new MachineSystem(new InventorySystem(), new EventBus());

    state.builds.sawmill.built = true;
    state.upgrades.autoMachines = 1;
    state.storage.wood = 2;
    player.x = 0;
    player.y = 55;

    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    system.update(state, player, getDerivedStats(state), 2);

    expect(state.storage.wood).toBe(0);
    expect(state.storage.planks).toBe(1);
  });
});
