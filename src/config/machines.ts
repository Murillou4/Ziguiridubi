import { CostMap, ResourceId } from '../domain/types.ts';

export interface MachineRecipe {
  id: string;
  name: string;
  inputs: CostMap;
  outputResource: ResourceId;
  baseRate: number; // progress per second
  floatText: string;
  floatColor: string;
  burstColor: string;
  burstCount: number;
}

export const MACHINE_RECIPES = {
  sawmill: {
    id: 'sawmill',
    name: 'Serraria Manual',
    inputs: { wood: 2 },
    outputResource: 'planks',
    baseRate: 0.55,
    floatText: 'Tábua',
    floatColor: '#fcd34d',
    burstColor: '#dca058',
    burstCount: 8
  },
  furnace: {
    id: 'furnace',
    name: 'Fornalha de Pedra',
    inputs: { ironOre: 2 },
    outputResource: 'ironIngot',
    baseRate: 0.45,
    floatText: 'Lingote',
    floatColor: '#e2e8f0',
    burstColor: '#f97316',
    burstCount: 9
  },
  gearWorkshop: {
    id: 'gearWorkshop',
    name: 'Oficina de Engrenagens',
    inputs: { ironIngot: 2, planks: 2 },
    outputResource: 'gears',
    baseRate: 0.38,
    floatText: 'Engrenagem',
    floatColor: '#fbbf24',
    burstColor: '#f59e0b',
    burstCount: 10
  }
} as const satisfies Record<string, MachineRecipe>;

export type MachineId = keyof typeof MACHINE_RECIPES;
