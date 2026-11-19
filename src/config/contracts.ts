import { CostMap } from '../domain/types.ts';

export interface ContractTemplate {
  title: string;
  req: CostMap;
  coins: number;
  blueprints: number;
  minPhase?: number;
}

export const BASE_CONTRACT_TEMPLATES: ContractTemplate[] = [
  { title: 'Carpintaria da Vila',   req: { planks: 8, wood: 6 },       coins: 95,  blueprints: 1 },
  { title: 'Muralha do Jardim',     req: { stone: 12, planks: 6 },     coins: 110, blueprints: 1 },
  { title: 'Ferreiro do Vale',      req: { ironIngot: 6, planks: 8 },  coins: 210, blueprints: 1 },
  { title: 'Relojoeiro Celeste',    req: { gears: 4, ironIngot: 6 },   coins: 360, blueprints: 2 },
  { title: 'Frota a Vapor',         req: { steamCore: 2, gears: 5 },   coins: 540, blueprints: 2, minPhase: 4 },
  { title: 'Observatório Astral',   req: { etherCryst: 3, gears: 4 },  coins: 720, blueprints: 3, minPhase: 4 }
];
