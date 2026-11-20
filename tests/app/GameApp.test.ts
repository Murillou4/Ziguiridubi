import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApp } from '../../src/app/GameApp.ts';
import { GameAppServices } from '../../src/app/GameContext.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { SavePayload } from '../../src/domain/types.ts';
import { createDefaultAudioSettings } from '../../src/audio/AudioSettings.ts';
import { DroneSystem } from '../../src/gameplay/DroneSystem.ts';
import { InventorySystem } from '../../src/gameplay/InventorySystem.ts';
import { UpgradeSystem } from '../../src/gameplay/UpgradeSystem.ts';

function createTestApp() {
  const eventBus = new EventBus();
  const droneSystem = new DroneSystem(eventBus);
  const audio = {
    settings: createDefaultAudioSettings(),
    applyVolumes: vi.fn()
  };
  const saveService = { save: vi.fn() };
  const ui = {
    activeModal: null,
    refreshAll: vi.fn()
  };
  const gatheringSystem = { drops: [] };

  const services = {
    eventBus,
    droneSystem,
    audio,
    saveService,
    ui,
    worldSystem: { isPointWalkable: () => true },
    gatheringSystem
  } as unknown as GameAppServices;

  return {
    app: new GameApp(services),
    eventBus,
    droneSystem,
    audio,
    saveService,
    ui,
    gatheringSystem
  };
}

describe('GameApp drone lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { addEventListener: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('spawns drones immediately when their upgrades are purchased', () => {
    const { app, eventBus, droneSystem } = createTestApp();
    const upgradeSystem = new UpgradeSystem(new InventorySystem(), eventBus);

    app.state.builds.droneStation.built = true;
    Object.assign(app.state.storage, {
      gears: 100,
      ironIngot: 100,
      coins: 5000,
      steamCore: 100,
      etherCryst: 100
    });

    expect(upgradeSystem.buyUpgrade(app.state, app.player, 'lumberDrone')).toBe(true);
    expect(droneSystem.drones.filter(drone => drone.kind === 'lumber')).toHaveLength(1);

    expect(upgradeSystem.buyUpgrade(app.state, app.player, 'minerDrone')).toBe(true);
    expect(droneSystem.drones.filter(drone => drone.kind === 'miner')).toHaveLength(1);
    expect(droneSystem.drones).toHaveLength(2);
  });

  it('recreates runtime drones from imported save levels without retaining old cargo', () => {
    const { app, droneSystem } = createTestApp();
    const previousState = createDefaultState();
    previousState.upgrades.lumberDrone = 2;
    previousState.upgrades.minerDrone = 1;
    droneSystem.syncDrones(previousState);
    droneSystem.drones[0].cargo = ['wood'];
    droneSystem.drones[0].state = 'return';

    const importedState = createDefaultState();
    importedState.upgrades.lumberDrone = 1;
    const payload: SavePayload = {
      version: 1,
      timestamp: 123,
      state: importedState,
      playerPos: { x: 12, y: 34 },
      audio: createDefaultAudioSettings()
    };

    app.applySavePayload(payload);

    expect(droneSystem.drones).toHaveLength(1);
    expect(droneSystem.drones[0].kind).toBe('lumber');
    expect(droneSystem.drones[0].state).toBe('seek');
    expect(droneSystem.drones[0].targetNode).toBeNull();
    expect(droneSystem.drones[0].cargo).toEqual([]);
    expect(app.player.x).toBe(12);
    expect(app.player.y).toBe(34);
  });
});
