import { ResourceDef, ResourceId } from '../domain/types.ts';

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  wood:       { id: 'wood',       name: 'Madeira',           icon: '🪓', color: '#b46936', sellPrice: 2,   tier: 1 },
  stone:      { id: 'stone',      name: 'Pedra',             icon: '🪨', color: '#8c969e', sellPrice: 3,   tier: 1 },
  planks:     { id: 'planks',     name: 'Tábua',             icon: '🪵', color: '#dca058', sellPrice: 9,   tier: 1 },
  ironOre:    { id: 'ironOre',    name: 'Minério de Ferro',  icon: '⛏️', color: '#94a3b8', sellPrice: 7,   tier: 2 },
  ironIngot:  { id: 'ironIngot',  name: 'Lingote de Ferro',  icon: '🔨', color: '#cbd5e1', sellPrice: 24,  tier: 2 },
  gears:      { id: 'gears',      name: 'Engrenagem',        icon: '⚙️', color: '#f59e0b', sellPrice: 55,  tier: 3 },
  steamCore:  { id: 'steamCore',  name: 'Núcleo de Vapor',   icon: '🫁', color: '#38bdf8', sellPrice: 95,  tier: 3 },
  etherCryst: { id: 'etherCryst', name: 'Cristal Etéreo',    icon: '💠', color: '#818cf8', sellPrice: 145, tier: 4 },
  relic:      { id: 'relic',      name: 'Relíquia Ancestral', icon: '🏺', color: '#f472b6', sellPrice: 0,   tier: 5 },
  blueprints: { id: 'blueprints', name: 'Planta Técnica',    icon: '📜', color: '#60a5fa', sellPrice: 0,   tier: 2 },
  coins:      { id: 'coins',      name: 'Moedas',            icon: '🪙', color: '#fde047', sellPrice: 0,   tier: 1 }
};
