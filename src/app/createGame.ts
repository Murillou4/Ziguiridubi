import { EventBus } from '../core/EventBus.ts';
import { InputManager } from '../input/InputManager.ts';
import { CanvasRenderer } from '../rendering/CanvasRenderer.ts';
import { AudioManager } from '../audio/AudioManager.ts';
import { SaveService } from '../persistence/SaveService.ts';
import { UIManager } from '../ui/UIManager.ts';

import { WorldSystem } from '../gameplay/WorldSystem.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { PlayerSystem } from '../gameplay/PlayerSystem.ts';
import { GatheringSystem } from '../gameplay/GatheringSystem.ts';
import { BuildingSystem } from '../gameplay/BuildingSystem.ts';
import { MachineSystem } from '../gameplay/MachineSystem.ts';
import { DroneSystem } from '../gameplay/DroneSystem.ts';
import { EconomySystem } from '../gameplay/EconomySystem.ts';
import { ContractSystem } from '../gameplay/ContractSystem.ts';
import { UpgradeSystem } from '../gameplay/UpgradeSystem.ts';
import { ProgressionSystem } from '../gameplay/ProgressionSystem.ts';
import { AirshipSystem } from '../gameplay/AirshipSystem.ts';

import { GameApp } from './GameApp.ts';

export function createGame(canvasId: string = 'gameCanvas'): GameApp {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error(`Elemento canvas com id "${canvasId}" não foi encontrado no documento.`);
  }

  const eventBus = new EventBus();
  const input = new InputManager(eventBus);
  const renderer = new CanvasRenderer(canvas);
  const audio = new AudioManager(eventBus);
  const saveService = new SaveService(eventBus);

  const worldSystem = new WorldSystem();
  const inventorySystem = new InventorySystem();
  const playerSystem = new PlayerSystem();
  const gatheringSystem = new GatheringSystem(eventBus);
  const buildingSystem = new BuildingSystem(inventorySystem, eventBus);
  const machineSystem = new MachineSystem(inventorySystem, eventBus);
  const droneSystem = new DroneSystem(eventBus);
  const economySystem = new EconomySystem(inventorySystem, eventBus);
  const contractSystem = new ContractSystem(inventorySystem, eventBus);
  const upgradeSystem = new UpgradeSystem(inventorySystem, eventBus);
  const progressionSystem = new ProgressionSystem(eventBus);
  const airshipSystem = new AirshipSystem(inventorySystem, eventBus);

  const ui = new UIManager(
    inventorySystem,
    buildingSystem,
    economySystem,
    contractSystem,
    upgradeSystem,
    machineSystem,
    progressionSystem,
    airshipSystem,
    audio,
    saveService,
    eventBus
  );

  return new GameApp({
    eventBus,
    input,
    renderer,
    audio,
    saveService,
    ui,
    worldSystem,
    inventorySystem,
    playerSystem,
    gatheringSystem,
    buildingSystem,
    machineSystem,
    droneSystem,
    economySystem,
    contractSystem,
    upgradeSystem,
    progressionSystem,
    airshipSystem
  });
}
