/**
 * TIPOS E INTERFACES DE DOMÍNIO — OFICINA DO VALE
 */

export type ResourceId =
  | 'wood'
  | 'stone'
  | 'planks'
  | 'ironOre'
  | 'ironIngot'
  | 'gears'
  | 'steamCore'
  | 'etherCryst'
  | 'relic'
  | 'blueprints'
  | 'coins';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  icon: string;
  color: string;
  sellPrice: number;
  tier: number;
}

export type UpgradeCategory = 'tools' | 'capacity' | 'efficiency' | 'automation' | 'special';

export interface UpgradeCategoryDef {
  id: UpgradeCategory;
  label: string;
  icon: string;
}

export type CostMap = Partial<Record<ResourceId, number>>;

export interface UpgradeDef {
  id: string;
  category: UpgradeCategory;
  name: string;
  desc: string;
  maxLevel: number;
  costs: CostMap[];
  requiresBuild?: string;
  effectText: (lvl: number) => string;
}

export type SpecializationId = 'artisan' | 'airshipMagnate' | 'automataEngineer';

export interface SpecializationDef {
  id: SpecializationId;
  name: string;
  icon: string;
  tagline: string;
  bonuses: string[];
}

export interface AirshipRoute {
  id: string;
  name: string;
  duration: number; // segundos base
  desc: string;
  cost: CostMap;
  rewards: CostMap;
}

export interface PhaseInfo {
  phase: number;
  title: string;
  desc: string;
}

export interface IslandDef {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  topColor: string;
  edgeColor: string;
  cliffColor: string;
  unlocked: (state: GameState) => boolean;
}

export interface BlueprintDef {
  id: string;
  name: string;
  desc: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isBridge?: boolean;
  cost: CostMap;
  onComplete?: () => void;
}

export type NodeType = 'tree' | 'rock' | 'iron' | 'ether';

export interface ResourceNode {
  id: string;
  type: NodeType;
  islandId: string;
  x: number;
  y: number;
  name: string;
  resource: ResourceId;
  hp: number;
  maxHp: number;
  reqPower: number;
  radius: number;
  mat: 'wood' | 'stone' | 'iron' | 'ether';
  respawnTime: number;
  respawnTimer: number;
  depleted: boolean;
  hitAnim: number;
  sweetSpotTimer: number;
  sweetSpotDuration: number;
}

export interface DropItem {
  resource: ResourceId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
}

export type DroneKind = 'lumber' | 'miner';
export type DroneState = 'seek' | 'move' | 'harvest' | 'return';

export interface DroneEntity {
  kind: DroneKind;
  x: number;
  y: number;
  state: DroneState;
  targetNode: ResourceNode | null;
  cargo: ResourceId[];
  workTimer: number;
  bobPhase: number;
}

export interface Contract {
  id: string;
  title: string;
  req: CostMap;
  coins: number;
  blueprints: number;
}

export interface MachineState {
  progress: number;
}

export interface BuildProgress {
  built: boolean;
  paid: CostMap;
}

export interface AirshipState {
  activeRouteId: string | null;
  elapsed: number;
  duration: number;
  completed: boolean;
}

export interface GameStats {
  totalHarvested: number;
  criticalHits: number;
  coinsEarned: number;
}

export interface GameState {
  phase: number;
  storage: Record<ResourceId, number>;
  upgrades: Record<string, number>;
  specialization: SpecializationId | null;
  builds: Record<string, BuildProgress>;
  trackedBuildId: string | null;
  machines: Record<string, MachineState>;
  airship: AirshipState;
  contracts: Contract[];
  stats: GameStats;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  tilt: number;
  walkCycle: number;
  swingTimer: number;
  swingDuration: number;
  swingAngleStart: number;
  swingAngleEnd: number;
  cooldownTimer: number;
  dashTimer: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirY: number;
  invulnTimer: number;
  backpack: ResourceId[];
  moveTarget: { x: number; y: number; autoHitNode?: ResourceNode } | null;
}

export interface DerivedStats {
  maxBackpack: number;
  toolPower: number;
  swingSpeedMult: number;
  reachRadius: number;
  swingArc: number;
  sweetSpotWindow: number;
  critMult: number;
  magnetRadius: number;
  moveSpeed: number;
  dashCooldown: number;
  stationSpeedMult: number;
  doubleYieldChance: number;
  merchantMult: number;
  airshipSpeedMult: number;
  airshipRewardMult: number;
  droneSpeedMult: number;
  droneCap: number;
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  musicMuted: boolean;
  sfxMuted: boolean;
}

export interface SavePayload {
  version: number;
  timestamp: number;
  state: GameState;
  playerPos: { x: number; y: number };
  audio: AudioSettings;
}
