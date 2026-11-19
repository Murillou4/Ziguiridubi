import { DerivedStats, GameState, PlayerState } from '../domain/types.ts';
import { BlueprintConfig } from '../config/buildings.ts';
import { EventBus } from '../core/EventBus.ts';
import { GameClock } from '../core/GameClock.ts';
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

/** Dependências externas e sistemas compostos na inicialização da aplicação. */
export interface GameAppServices {
  eventBus: EventBus;
  input: InputManager;
  renderer: CanvasRenderer;
  audio: AudioManager;
  saveService: SaveService;
  ui: UIManager;
  worldSystem: WorldSystem;
  inventorySystem: InventorySystem;
  playerSystem: PlayerSystem;
  gatheringSystem: GatheringSystem;
  buildingSystem: BuildingSystem;
  machineSystem: MachineSystem;
  droneSystem: DroneSystem;
  economySystem: EconomySystem;
  contractSystem: ContractSystem;
  upgradeSystem: UpgradeSystem;
  progressionSystem: ProgressionSystem;
  airshipSystem: AirshipSystem;
}

/**
 * Contexto de runtime compartilhado pelos controladores.
 * Getters evitam referências obsoletas quando um save é carregado ou a jornada é reiniciada.
 */
export interface GameRuntimeContext extends GameAppServices {
  clock: GameClock;
  getState(): GameState;
  setState(state: GameState): void;
  getPlayer(): PlayerState;
  setPlayer(player: PlayerState): void;
  getIsPlaying(): boolean;
  setIsPlaying(value: boolean): void;
  isModalOpen(): boolean;
  getHoveredBlueprint(): BlueprintConfig | null;
  setHoveredBlueprint(blueprint: BlueprintConfig | null): void;
  getStats(): DerivedStats;
}
