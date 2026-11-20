import type { DroneKind, NodeType } from '../domain/types.ts';

export const DRONE_MODELS = {
  lumber: { upgrade: 'lumberDrone', target: 'tree', spawnX: 220, spawnY: -110 },
  miner: { upgrade: 'minerDrone', target: 'rock', spawnX: 250, spawnY: -110 },
  iron: { upgrade: 'ironDrone', target: 'iron', spawnX: 220, spawnY: -76 },
  crystal: { upgrade: 'crystalDrone', target: 'ether', spawnX: 250, spawnY: -76 }
} as const satisfies Record<DroneKind, { upgrade: string; target: NodeType; spawnX: number; spawnY: number }>;

export const DRONE_KINDS = Object.keys(DRONE_MODELS) as DroneKind[];
