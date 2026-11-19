import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { getDerivedStats } from '../../src/domain/Stats.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { DroneSystem } from '../../src/gameplay/DroneSystem.ts';
import { WorldSystem } from '../../src/gameplay/WorldSystem.ts';

describe('DroneSystem', () => {
  it('sincroniza a quantidade de drones com os upgrades adquiridos', () => {
    const state = createDefaultState();
    const system = new DroneSystem(new EventBus());

    state.upgrades.lumberDrone = 2;
    state.upgrades.minerDrone = 1;
    system.syncDrones(state);

    expect(system.drones).toHaveLength(3);
    expect(system.drones.filter(drone => drone.kind === 'lumber')).toHaveLength(2);
    expect(system.drones.filter(drone => drone.kind === 'miner')).toHaveLength(1);
  });

  it('envia drones lenhadores somente para árvores disponíveis', () => {
    const state = createDefaultState();
    const system = new DroneSystem(new EventBus());
    const world = new WorldSystem();

    state.upgrades.lumberDrone = 1;
    system.syncDrones(state);
    system.update(state, getDerivedStats(state), world.nodes, world.islands, 0.016);

    expect(system.drones[0].targetNode).not.toBeNull();
    expect(system.drones[0].targetNode?.type).toBe('tree');
  });

  it('envia drones mineradores para rochas, ferro ou cristais, nunca para árvores', () => {
    const state = createDefaultState();
    const system = new DroneSystem(new EventBus());
    const world = new WorldSystem();

    state.upgrades.minerDrone = 1;
    system.syncDrones(state);
    system.update(state, getDerivedStats(state), world.nodes, world.islands, 0.016);

    expect(system.drones[0].targetNode).not.toBeNull();
    expect(['rock', 'iron', 'ether']).toContain(system.drones[0].targetNode?.type);
  });

  it('faz um drone retornar a carga ao armazém e contabiliza a coleta', () => {
    const state = createDefaultState();
    const system = new DroneSystem(new EventBus());
    const world = new WorldSystem();

    state.upgrades.lumberDrone = 1;
    system.syncDrones(state);

    const drone = system.drones[0];
    drone.state = 'return';
    drone.x = 95;
    drone.y = -37;
    drone.cargo = ['wood', 'wood', 'stone'];

    system.update(state, getDerivedStats(state), world.nodes, world.islands, 0.016);

    expect(state.storage.wood).toBe(2);
    expect(state.storage.stone).toBe(1);
    expect(state.stats.totalHarvested).toBe(3);
    expect(drone.cargo).toEqual([]);
    expect(drone.state).toBe('seek');
  });
});
