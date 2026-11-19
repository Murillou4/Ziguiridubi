import { AirshipRoute } from '../domain/types.ts';

export const AIRSHIP_ROUTES: AirshipRoute[] = [
  {
    id: 'cloud_village',
    name: 'Vila das Nuvens',
    duration: 30,
    desc: 'Rota comercial próxima. Traz Moedas e Núcleos de Vapor.',
    cost: { planks: 12, stone: 6 },
    rewards: { coins: 160, steamCore: 1 }
  },
  {
    id: 'crystal_archipelago',
    name: 'Arquipélago de Cristal',
    duration: 55,
    desc: 'Expedição intermediária às ilhas flutuantes de cristal.',
    cost: { ironIngot: 8, gears: 4 },
    rewards: { coins: 480, etherCryst: 2 }
  },
  {
    id: 'celestial_citadel',
    name: 'Cidadela Celeste',
    duration: 85,
    desc: 'Viagem épica aos confins do céu em busca de Relíquias Ancestrais.',
    cost: { gears: 6, etherCryst: 3 },
    rewards: { coins: 1350, relic: 1 }
  }
];
