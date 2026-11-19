import { GameState, IslandDef, NodeType, ResourceId } from '../domain/types.ts';

export interface NodeConfig {
  name: string;
  resource: ResourceId;
  maxHp: number;
  reqPower: number;
  radius: number;
  mat: 'wood' | 'stone' | 'iron' | 'ether';
  respawn: number;
}

export const NODE_CONFIGS: Record<NodeType, NodeConfig> = {
  tree:  { name: 'Carvalho do Vale', resource: 'wood',       maxHp: 3, reqPower: 1, radius: 26, mat: 'wood',  respawn: 10 },
  rock:  { name: 'Rocha de Ardósia', resource: 'stone',      maxHp: 4, reqPower: 1, radius: 24, mat: 'stone', respawn: 12 },
  iron:  { name: 'Veio de Ferro',    resource: 'ironOre',    maxHp: 5, reqPower: 2, radius: 26, mat: 'iron',  respawn: 14 },
  ether: { name: 'Cristal Etéreo',   resource: 'etherCryst', maxHp: 6, reqPower: 3, radius: 27, mat: 'ether', respawn: 17 }
};

export const ISLANDS_DEF: IslandDef[] = [
  {
    id: 'hub',
    name: 'Clareira do Vale',
    x: 0,
    y: 0,
    w: 680,
    h: 520,
    topColor: '#568c54',
    edgeColor: '#3b663c',
    cliffColor: '#5c4b3b',
    unlocked: () => true
  },
  {
    id: 'east_hill',
    name: 'Colina de Ferro',
    x: 760,
    y: 0,
    w: 540,
    h: 440,
    topColor: '#6b7f59',
    edgeColor: '#4b5c3e',
    cliffColor: '#57483b',
    unlocked: (s: GameState) => Boolean(s.builds.eastBridge?.built)
  },
  {
    id: 'north_dock',
    name: 'Doca dos Ventos',
    x: 0,
    y: -560,
    w: 460,
    h: 360,
    topColor: '#678566',
    edgeColor: '#476146',
    cliffColor: '#54463a',
    unlocked: (s: GameState) => Boolean(s.builds.northBridge?.built)
  },
  {
    id: 'west_crystal',
    name: 'Ilha de Cristal',
    x: -760,
    y: 0,
    w: 520,
    h: 440,
    topColor: '#4c6d8a',
    edgeColor: '#334e66',
    cliffColor: '#2d3b4d',
    unlocked: (s: GameState) => Boolean(s.builds.westBridge?.built)
  }
];

export interface NodeSpawnPoint {
  type: NodeType;
  x: number;
  y: number;
  islandId: string;
}

export const INITIAL_NODE_SPAWNS: NodeSpawnPoint[] = [
  // Clareira do Vale (Hub)
  { type: 'tree', x: -265, y: -175, islandId: 'hub' },
  { type: 'tree', x: -285, y: -35,  islandId: 'hub' },
  { type: 'tree', x: -265, y: 185,  islandId: 'hub' },
  { type: 'tree', x: -125, y: 215,  islandId: 'hub' },
  { type: 'tree', x: 135,  y: 215,  islandId: 'hub' },
  { type: 'tree', x: 270,  y: 185,  islandId: 'hub' },
  { type: 'tree', x: 280,  y: -175, islandId: 'hub' },
  { type: 'tree', x: -115, y: -205, islandId: 'hub' },
  { type: 'tree', x: 95,   y: -205, islandId: 'hub' },
  { type: 'rock', x: -285, y: 80,   islandId: 'hub' },
  { type: 'rock', x: 275,  y: 80,   islandId: 'hub' },
  { type: 'rock', x: 225,  y: -205, islandId: 'hub' },
  { type: 'rock', x: -220, y: -205, islandId: 'hub' },

  // Colina de Ferro (East Hill)
  { type: 'iron', x: 610, y: -135, islandId: 'east_hill' },
  { type: 'iron', x: 740, y: -165, islandId: 'east_hill' },
  { type: 'iron', x: 900, y: -125, islandId: 'east_hill' },
  { type: 'iron', x: 955, y: 25,   islandId: 'east_hill' },
  { type: 'iron', x: 860, y: 145,  islandId: 'east_hill' },
  { type: 'iron', x: 685, y: 145,  islandId: 'east_hill' },
  { type: 'iron', x: 770, y: 5,    islandId: 'east_hill' },
  { type: 'rock', x: 575, y: 115,  islandId: 'east_hill' },
  { type: 'rock', x: 965, y: -85,  islandId: 'east_hill' },
  { type: 'rock', x: 630, y: -25,  islandId: 'east_hill' },
  { type: 'tree', x: 825, y: -175, islandId: 'east_hill' },
  { type: 'tree', x: 925, y: 115,  islandId: 'east_hill' },

  // Doca dos Ventos (North Dock)
  { type: 'tree', x: -175, y: -475, islandId: 'north_dock' },
  { type: 'tree', x: 175,  y: -475, islandId: 'north_dock' },
  { type: 'tree', x: 165,  y: -665, islandId: 'north_dock' },
  { type: 'rock', x: -165, y: -665, islandId: 'north_dock' },
  { type: 'rock', x: 185,  y: -565, islandId: 'north_dock' },

  // Ilha de Cristal (West Crystal)
  { type: 'ether', x: -620, y: -135, islandId: 'west_crystal' },
  { type: 'ether', x: -765, y: -165, islandId: 'west_crystal' },
  { type: 'ether', x: -920, y: -120, islandId: 'west_crystal' },
  { type: 'ether', x: -950, y: 35,   islandId: 'west_crystal' },
  { type: 'ether', x: -850, y: 150,  islandId: 'west_crystal' },
  { type: 'ether', x: -660, y: 145,  islandId: 'west_crystal' },
  { type: 'ether', x: -775, y: 10,   islandId: 'west_crystal' }
];
