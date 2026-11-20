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

  it('envia o extrator de pedra somente para rochas', () => {
    const state = createDefaultState();
    const system = new DroneSystem(new EventBus());
    const world = new WorldSystem();

    state.upgrades.minerDrone = 1;
    system.syncDrones(state);
    system.update(state, getDerivedStats(state), world.nodes, world.islands, 0.016);

    expect(system.drones[0].targetNode).not.toBeNull();
    expect(system.drones[0].targetNode?.type).toBe('rock');
  });

  it('faz cada drone buscar seu próprio recurso e entregar no armazém após liberar as ilhas', () => {
    const state = createDefaultState();
    Object.assign(state.upgrades, { lumberDrone: 1, minerDrone: 1, ironDrone: 1, crystalDrone: 1 });
    const system = new DroneSystem(new EventBus());
    const world = new WorldSystem();
    world.nodes = [];
    world.spawnNode('tree', 210, -90, 'hub');
    world.spawnNode('rock', 245, -90, 'hub');
    world.spawnNode('iron', 810, -25, 'east_hill');
    world.spawnNode('ether', -810, -25, 'west_crystal');
    system.syncDrones(state);
    const stats = getDerivedStats(state);
    system.update(state, stats, world.nodes, world.islands, .05);

    expect(system.drones.map(drone => drone.targetNode?.type)).toEqual(['tree', 'rock', undefined, undefined]);
    state.builds.eastBridge.built = true;
    state.builds.westBridge.built = true;
    system.update(state, stats, world.nodes, world.islands, .05);
    expect(system.drones.map(drone => drone.targetNode?.type)).toEqual(['tree', 'rock', 'iron', 'ether']);

    for (let i = 0; i < 340; i++) system.update(state, stats, world.nodes, world.islands, .05);
    expect(state.storage.wood).toBeGreaterThan(0);
    expect(state.storage.stone).toBeGreaterThan(0);
    expect(state.storage.ironOre).toBeGreaterThan(0);
    expect(state.storage.etherCryst).toBeGreaterThan(0);
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

  it('remove drones excedentes quando os níveis importados são menores', () => {
    const state = createDefaultState();
    const system = new DroneSystem(new EventBus());

    state.upgrades.lumberDrone = 2;
    state.upgrades.minerDrone = 1;
    system.syncDrones(state);

    const keptLumberDrone = system.drones.find(drone => drone.kind === 'lumber');
    expect(keptLumberDrone).toBeDefined();

    state.upgrades.lumberDrone = 1;
    state.upgrades.minerDrone = 0;
    system.syncDrones(state);

    expect(system.drones).toHaveLength(1);
    expect(system.drones[0]).toBe(keptLumberDrone);
    expect(system.drones[0].kind).toBe('lumber');
  });

  it('é idempotente e não cria drones duplicados ao sincronizar repetidamente', () => {
    const state = createDefaultState();
    const system = new DroneSystem(new EventBus());

    state.upgrades.lumberDrone = 2;
    state.upgrades.minerDrone = 1;
    system.syncDrones(state);
    const originalDrones = [...system.drones];

    system.syncDrones(state);

    expect(system.drones).toHaveLength(3);
    expect(system.drones).toEqual(originalDrones);
  });

});
