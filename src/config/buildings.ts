import { CostMap, GameState } from '../domain/types.ts';

const AIRSHIP_DOCK_BOUNDS = { x: 45, y: 340, w: 140, h: 98 };

const STATIONS = [
  { x: -95, y: -25, range: 95, label: 'Mercador', modal: 'modalMerchant' },
  { x: 95, y: -25, range: 95, label: 'Armazém', modal: 'modalWorkshop' },
  {
    x: AIRSHIP_DOCK_BOUNDS.x + AIRSHIP_DOCK_BOUNDS.w / 2,
    y: AIRSHIP_DOCK_BOUNDS.y + AIRSHIP_DOCK_BOUNDS.h / 2,
    range: 135,
    label: 'Cais do Dirigível',
    modal: 'modalAirship',
    buildId: 'airshipDock'
  }
];

export function getNearbyStation(x: number, y: number, state: GameState) {
  return STATIONS.find(station =>
    (!station.buildId || state.builds[station.buildId]?.built) &&
    Math.hypot(x - station.x, y - station.y) < station.range
  );
}

export interface BlueprintConfig {
  id: string;
  name: string;
  desc: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isBridge?: boolean;
  cost: CostMap;
  requiresBuild?: string;
  nextTrackedBuildId?: string | null;
  advanceToPhase?: number;
  completionToast: string;
}

export const BLUEPRINTS_DEF: BlueprintConfig[] = [
  {
    id: 'sawmill',
    name: 'Serraria Manual',
    desc: 'Transforma Madeira em Tábuas valiosas (9 Moedas cada).',
    x: -270,
    y: 177,
    w: 96,
    h: 78,
    cost: { wood: 6 },
    nextTrackedBuildId: 'eastBridge',
    completionToast: ' Serraria Manual concluída! Ela converte Madeira em Tábuas automaticamente.'
  },
  {
    id: 'eastBridge',
    name: 'Ponte Leste: Colina de Ferro',
    desc: 'Abre acesso aos ricos veios de Minério de Ferro a leste.',
    x: 490,
    y: -38,
    w: 170,
    h: 76,
    isBridge: true,
    cost: { planks: 10, stone: 8, coins: 35 },
    nextTrackedBuildId: 'furnace',
    advanceToPhase: 2,
    completionToast: ' Ponte Leste construída! Explore a Colina de Ferro a leste.'
  },
  {
    id: 'furnace',
    name: 'Fornalha de Pedra',
    desc: 'Funde Minério de Ferro em Lingotes de Ferro (24 Moedas cada).',
    x: -48,
    y: 177,
    w: 96,
    h: 78,
    cost: { stone: 12, planks: 8, coins: 40 },
    nextTrackedBuildId: 'gearWorkshop',
    completionToast: ' Fornalha de Pedra pronta! Agora você pode fundir Lingotes de Ferro.'
  },
  {
    id: 'gearWorkshop',
    name: 'Oficina de Engrenagens',
    desc: 'Forja Engrenagens de precisão para o Dirigível e Drones.',
    x: 170,
    y: 178,
    w: 104,
    h: 76,
    cost: { ironIngot: 8, planks: 12, coins: 110 },
    nextTrackedBuildId: 'northBridge',
    advanceToPhase: 3,
    completionToast: ' Oficina de Engrenagens concluída!'
  },
  {
    id: 'northBridge',
    name: 'Ponte Norte: Doca dos Ventos',
    desc: 'Conecta a ilha central à Doca dos Ventos e libera a construção do Cais do Dirigível.',
    x: -38,
    y: -390,
    w: 76,
    h: 80,
    isBridge: true,
    cost: { planks: 16, ironIngot: 8, coins: 140 },
    nextTrackedBuildId: 'airshipDock',
    completionToast: 'Ponte Norte aberta! O Cais do Dirigível já pode ser construído ao sul da clareira.'
  },
  {
    id: 'airshipDock',
    name: 'Cais do Dirigível',
    desc: 'Recebe o dirigível das expedições aéreas. Requer a Ponte Norte.',
    ...AIRSHIP_DOCK_BOUNDS,
    requiresBuild: 'northBridge',
    cost: { planks: 20, ironIngot: 12, gears: 4, coins: 200 },
    nextTrackedBuildId: 'droneStation',
    advanceToPhase: 4,
    completionToast: ' Cais do Dirigível construído! Pressione [E] nele para lançar expedições.'
  },
  {
    id: 'droneStation',
    name: 'Estação de Drones',
    desc: 'Libera a construção de Drones Lenhadores e Mineradores autônomos.',
    x: -164,
    y: 326,
    w: 96,
    h: 78,
    cost: { ironIngot: 10, gears: 6, coins: 220 },
    nextTrackedBuildId: 'westBridge',
    completionToast: ' Estação de Drones pronta! Contrate Drones na Bancada de Upgrades.'
  },
  {
    id: 'westBridge',
    name: 'Ponte Oeste: Ilha de Cristal',
    desc: 'Abre o caminho para os Cristais Etéreos e o Endgame Celeste.',
    x: -670,
    y: -38,
    w: 180,
    h: 76,
    isBridge: true,
    cost: { gears: 10, steamCore: 3, coins: 420 },
    nextTrackedBuildId: null,
    advanceToPhase: 5,
    completionToast: ' Ponte Oeste concluída! Bem-vindo à Ilha de Cristal.'
  }
];

type BridgeEntranceSide = 'left' | 'right' | 'top' | 'bottom';

export interface BridgeLayout {
  isHorizontal: boolean;
  entrance: BridgeEntranceSide;
  /** Ponto central da entrada na margem acessível. */
  entryX: number;
  entryY: number;
  /** Vetor unitário apontando da entrada para o interior da ilha (terra firme). */
  inwardX: number;
  inwardY: number;
}

export function resolveBridgeLayout(bp: BlueprintConfig): BridgeLayout {
  const isHorizontal = bp.w >= bp.h;
  const cx = bp.x + bp.w / 2;
  const cy = bp.y + bp.h / 2;

  if (isHorizontal) {
    const leftDist = Math.hypot(bp.x, cy);
    const rightDist = Math.hypot(bp.x + bp.w, cy);
    const isLeftEntry = leftDist <= rightDist;
    return {
      isHorizontal: true,
      entrance: isLeftEntry ? 'left' : 'right',
      entryX: isLeftEntry ? bp.x : bp.x + bp.w,
      entryY: cy,
      inwardX: isLeftEntry ? -1 : 1,
      inwardY: 0
    };
  }

  const topDist = Math.hypot(cx, bp.y);
  const bottomDist = Math.hypot(cx, bp.y + bp.h);
  const isTopEntry = topDist <= bottomDist;
  return {
    isHorizontal: false,
    entrance: isTopEntry ? 'top' : 'bottom',
    entryX: cx,
    entryY: isTopEntry ? bp.y : bp.y + bp.h,
    inwardX: 0,
    inwardY: isTopEntry ? -1 : 1
  };
}

export function getBlueprintDistance(bp: BlueprintConfig, x: number, y: number): number {
  const distance = Math.hypot(x - bp.x - bp.w / 2, y - bp.y - bp.h / 2);
  if (!bp.isBridge) return distance;

  const { entryX, entryY } = resolveBridgeLayout(bp);
  return Math.min(distance, Math.hypot(x - entryX, y - entryY));
}
