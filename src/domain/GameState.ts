import { GameState } from './types.ts';

export function createDefaultState(): GameState {
  return {
    phase: 1,
    storage: {
      wood: 0,
      stone: 0,
      planks: 0,
      ironOre: 0,
      ironIngot: 0,
      gears: 0,
      steamCore: 0,
      etherCryst: 0,
      relic: 0,
      blueprints: 0,
      coins: 15
    },
    upgrades: {
      toolPower: 0,
      toolSpeed: 0,
      toolReach: 0,
      sweetSpotMastery: 0,
      backpackSize: 0,
      lightBoots: 0,
      stationSpeed: 0,
      doubleYield: 0,
      merchantFavor: 0,
      autoMachines: 0,
      lumberDrone: 0,
      minerDrone: 0,
      steamDash: 0,
      magnetCoil: 0,
      relicCelestialCore: 0
    },
    specialization: null,
    builds: {
      sawmill:      { built: false, paid: {} },
      furnace:      { built: false, paid: {} },
      gearWorkshop: { built: false, paid: {} },
      droneStation: { built: false, paid: {} },
      eastBridge:   { built: false, paid: {} },
      northBridge:  { built: false, paid: {} },
      airshipDock:  { built: false, paid: {} },
      westBridge:   { built: false, paid: {} }
    },
    trackedBuildId: 'sawmill',
    machines: {
      sawmill:      { progress: 0 },
      furnace:      { progress: 0 },
      gearWorkshop: { progress: 0 }
    },
    airship: {
      activeRouteId: null,
      elapsed: 0,
      duration: 0,
      completed: false
    },
    contracts: [],
    stats: {
      totalHarvested: 0,
      criticalHits: 0,
      coinsEarned: 0
    }
  };
}
