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
    y: 100,
    w: 1000,
    h: 840,
    topColor: '#568c54',
    edgeColor: '#3b663c',
    cliffColor: '#5c4b3b',
    unlocked: () => true
  },
  {
    id: 'east_hill',
    name: 'Colina de Ferro',
    x: 1080,
    y: 0,
    w: 860,
    h: 700,
    topColor: '#6b7f59',
    edgeColor: '#4b5c3e',
    cliffColor: '#57483b',
    unlocked: (s: GameState) => Boolean(s.builds.eastBridge?.built)
  },
  {
    id: 'north_dock',
    name: 'Doca dos Ventos',
    x: 0,
    y: -700,
    w: 740,
    h: 640,
    topColor: '#678566',
    edgeColor: '#476146',
    cliffColor: '#54463a',
    unlocked: (s: GameState) => Boolean(s.builds.northBridge?.built)
  },
  {
    id: 'west_crystal',
    name: 'Ilha de Cristal',
    x: -1080,
    y: 0,
    w: 840,
    h: 700,
    topColor: '#4c6d8a',
    edgeColor: '#334e66',
    cliffColor: '#2d3b4d',
    unlocked: (s: GameState) => Boolean(s.builds.westBridge?.built)
  }
];

export const ISLAND_RESOURCE_COUNTS: Record<string, Readonly<Partial<Record<NodeType, number>>>> = {
  hub: { tree: 17, rock: 9 },
  east_hill: { iron: 11, rock: 5, tree: 2 },
  north_dock: { tree: 6, rock: 4 },
  west_crystal: { ether: 11, rock: 1 }
};

export const HUB_PLAZA = { x: 0, y: 8, radiusX: 190, radiusY: 130 };

export type FaunaLocomotion = 'flutter' | 'songbird' | 'soar' | 'ground_hop' | 'ground_walk' | 'nocturnal_glow';

export type FaunaSpeciesId =
  | 'meadow_butterfly'
  | 'valley_songbird'
  | 'wind_gull'
  | 'breeze_swift'
  | 'hill_hare'
  | 'copper_hedgehog'
  | 'crystal_moth'
  | 'ether_owl';

/** Faixa horária local em horas decimais [0, 24). Suporta virada da meia-noite (ex.: 18.5 -> 5.5). */
export interface TimeWindow {
  startHour: number;
  endHour: number;
}

export interface FaunaSpeciesDef {
  id: FaunaSpeciesId;
  name: string;
  locomotion: FaunaLocomotion;
  airborne: boolean;
  speed: number;
  cruiseAltitude: number;
  restDuration: [number, number];
  moveDuration: [number, number];
  scale: number;
  primaryColors: readonly string[];
  accentColor: string;
  glowColor?: string;
}

export interface IslandFaunaEntry {
  speciesId: FaunaSpeciesId;
  count: number;
  windows: readonly TimeWindow[];
  /** Duração da entrada/saída gradual (em minutos reais) nas bordas de cada janela. */
  fadeMinutes: number;
  /** Escalonamento entre indivíduos da mesma espécie para não surgirem todos ao mesmo tempo. */
  staggerMinutes: number;
}

export const FAUNA_SPECIES_DEF: Record<FaunaSpeciesId, FaunaSpeciesDef> = {
  meadow_butterfly: {
    id: 'meadow_butterfly',
    name: 'Borboleta do Prado',
    locomotion: 'flutter',
    airborne: true,
    speed: 34,
    cruiseAltitude: 18,
    restDuration: [1.8, 4.2],
    moveDuration: [3.2, 6.5],
    scale: 1,
    primaryColors: ['#ffd35c', '#ff9fb8', '#8fd3ff', '#ffa86b', '#c8a6ff'],
    accentColor: '#5a3f2a'
  },
  valley_songbird: {
    id: 'valley_songbird',
    name: 'Pássaro Canoro do Vale',
    locomotion: 'songbird',
    airborne: false,
    speed: 68,
    cruiseAltitude: 28,
    restDuration: [2.4, 5.4],
    moveDuration: [1.4, 2.8],
    scale: 1,
    primaryColors: ['#60a5fa', '#f59e0b', '#fb7185', '#34d399'],
    accentColor: '#fef3c7'
  },
  wind_gull: {
    id: 'wind_gull',
    name: 'Gaivota dos Ventos',
    locomotion: 'soar',
    airborne: true,
    speed: 78,
    cruiseAltitude: 46,
    restDuration: [2.0, 4.0],
    moveDuration: [6.0, 12.0],
    scale: 1.15,
    primaryColors: ['#f8fafc', '#e2e8f0'],
    accentColor: '#64748b'
  },
  breeze_swift: {
    id: 'breeze_swift',
    name: 'Andorinha da Brisa',
    locomotion: 'soar',
    airborne: true,
    speed: 96,
    cruiseAltitude: 36,
    restDuration: [1.5, 3.0],
    moveDuration: [5.0, 9.0],
    scale: 0.9,
    primaryColors: ['#38bdf8', '#1e3a8a'],
    accentColor: '#bae6fd'
  },
  hill_hare: {
    id: 'hill_hare',
    name: 'Lebre da Colina',
    locomotion: 'ground_hop',
    airborne: false,
    speed: 56,
    cruiseAltitude: 0,
    restDuration: [2.8, 6.2],
    moveDuration: [1.2, 2.5],
    scale: 1,
    primaryColors: ['#d6b892', '#c49a6c', '#e7d3b5'],
    accentColor: '#fbcfe8'
  },
  copper_hedgehog: {
    id: 'copper_hedgehog',
    name: 'Ouriço Ferrugem',
    locomotion: 'ground_walk',
    airborne: false,
    speed: 32,
    cruiseAltitude: 0,
    restDuration: [2.2, 4.8],
    moveDuration: [2.0, 4.2],
    scale: 0.95,
    primaryColors: ['#9a5b34', '#7c4726'],
    accentColor: '#f5d0a9'
  },
  crystal_moth: {
    id: 'crystal_moth',
    name: 'Mariposa de Cristal',
    locomotion: 'nocturnal_glow',
    airborne: true,
    speed: 30,
    cruiseAltitude: 22,
    restDuration: [2.0, 4.5],
    moveDuration: [4.0, 7.5],
    scale: 1.05,
    primaryColors: ['#67e8f9', '#c084fc', '#a5f3fc'],
    accentColor: '#e0f2fe',
    glowColor: '#67e8f9'
  },
  ether_owl: {
    id: 'ether_owl',
    name: 'Coruja Etérea',
    locomotion: 'soar',
    airborne: true,
    speed: 58,
    cruiseAltitude: 38,
    restDuration: [4.0, 8.0],
    moveDuration: [3.2, 5.8],
    scale: 1.1,
    primaryColors: ['#cbd5e1', '#94a3b8'],
    accentColor: '#fde047',
    glowColor: '#bae6fd'
  }
};

/**
 * Configuração editável por ilha:
 * - Clareira do Vale (hub): borboletas e pássaros durante o dia
 * - Doca dos Ventos (north_dock): aves planando durante o dia
 * - Colina de Ferro (east_hill): pequenos animais no começo da manhã e fim da tarde
 * - Ilha de Cristal (west_crystal): fauna noturna (cruzando a meia-noite)
 */
export const ISLAND_FAUNA_CONFIG: Record<string, readonly IslandFaunaEntry[]> = {
  hub: [
    {
      speciesId: 'meadow_butterfly',
      count: 6,
      windows: [{ startHour: 6.5, endHour: 17.5 }],
      fadeMinutes: 30,
      staggerMinutes: 14
    },
    {
      speciesId: 'valley_songbird',
      count: 4,
      windows: [{ startHour: 5.5, endHour: 18.0 }],
      fadeMinutes: 30,
      staggerMinutes: 12
    }
  ],
  north_dock: [
    {
      speciesId: 'wind_gull',
      count: 4,
      windows: [{ startHour: 6.0, endHour: 18.5 }],
      fadeMinutes: 35,
      staggerMinutes: 15
    },
    {
      speciesId: 'breeze_swift',
      count: 2,
      windows: [{ startHour: 8.0, endHour: 16.5 }],
      fadeMinutes: 25,
      staggerMinutes: 10
    }
  ],
  east_hill: [
    {
      speciesId: 'hill_hare',
      count: 3,
      windows: [
        { startHour: 5.0, endHour: 9.0 },
        { startHour: 16.5, endHour: 19.5 }
      ],
      fadeMinutes: 25,
      staggerMinutes: 10
    },
    {
      speciesId: 'copper_hedgehog',
      count: 2,
      windows: [
        { startHour: 5.5, endHour: 8.5 },
        { startHour: 17.0, endHour: 19.5 }
      ],
      fadeMinutes: 25,
      staggerMinutes: 8
    }
  ],
  west_crystal: [
    {
      speciesId: 'crystal_moth',
      count: 5,
      windows: [{ startHour: 18.5, endHour: 5.5 }],
      fadeMinutes: 35,
      staggerMinutes: 15
    },
    {
      speciesId: 'ether_owl',
      count: 2,
      windows: [{ startHour: 19.5, endHour: 5.0 }],
      fadeMinutes: 35,
      staggerMinutes: 12
    }
  ]
};
