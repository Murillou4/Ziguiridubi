import { UpgradeCategoryDef, UpgradeDef } from '../domain/types.ts';

export const UPGRADE_CATEGORIES: UpgradeCategoryDef[] = [
  { id: 'tools',      label: 'Ferramentas',   icon: '' },
  { id: 'capacity',   label: 'Capacidade',    icon: '' },
  { id: 'efficiency', label: 'Eficiência',    icon: '' },
  { id: 'automation', label: 'Automação',     icon: '' },
  { id: 'special',    label: 'Especiais',     icon: '' }
];

export const UPGRADES_DEF: UpgradeDef[] = [
  // --- FERRAMENTAS ---
  {
    id: 'toolPower',
    category: 'tools',
    name: 'Machado & Picareta Temperados',
    desc: 'Aumenta o dano de coleta e libera jazidas mais duras (Ferro no Nv.2, Cristal Etéreo no Nv.3).',
    maxLevel: 5,
    costs: [
      { planks: 5, coins: 20 },
      { planks: 12, stone: 10, coins: 55 },
      { ironIngot: 8, planks: 15, coins: 140 },
      { gears: 6, ironIngot: 14, coins: 320 },
      { etherCryst: 4, gears: 10, coins: 650 }
    ],
    effectText: (lvl: number) => `Força ${lvl + 1} → ${lvl + 2}`
  },
  {
    id: 'toolSpeed',
    category: 'tools',
    name: 'Cabo Balanceado',
    desc: 'Acelera o balanço da ferramenta para golpear recursos muito mais rápido.',
    maxLevel: 4,
    costs: [
      { planks: 4, coins: 25 },
      { ironIngot: 5, coins: 75 },
      { gears: 4, coins: 190 },
      { etherCryst: 3, coins: 420 }
    ],
    effectText: (lvl: number) => `+${lvl * 16}% → +${(lvl + 1) * 16}% Velocidade de Golpe`
  },
  {
    id: 'toolReach',
    category: 'tools',
    name: 'Alcance Amplo',
    desc: 'Aumenta o raio e o arco do golpe, permitindo atingir várias árvores ou rochas juntas.',
    maxLevel: 4,
    costs: [
      { planks: 6, stone: 4, coins: 30 },
      { ironIngot: 6, coins: 85 },
      { gears: 5, coins: 210 },
      { etherCryst: 3, coins: 450 }
    ],
    effectText: (lvl: number) => `Alcance ${78 + lvl * 15}px → ${78 + (lvl + 1) * 15}px`
  },
  {
    id: 'sweetSpotMastery',
    category: 'tools',
    name: 'Lente de Precisão Crítica',
    desc: 'Amplia a zona dourada do Sweet Spot e multiplica os recursos extras no golpe perfeito.',
    maxLevel: 4,
    costs: [
      { planks: 5, coins: 35 },
      { ironIngot: 6, blueprints: 1, coins: 95 },
      { gears: 5, blueprints: 2, coins: 240 },
      { etherCryst: 4, coins: 500 }
    ],
    effectText: (lvl: number) => `Bônus Crítico ${(2 + lvl * 0.3).toFixed(1)}x → ${(2 + (lvl + 1) * 0.3).toFixed(1)}x`
  },

  // --- CAPACIDADE ---
  {
    id: 'backpackSize',
    category: 'capacity',
    name: 'Mochila de Carga Empilhável',
    desc: 'Permite carregar mais itens físicos nas costas antes de precisar descarregar.',
    maxLevel: 5,
    costs: [
      { planks: 5, coins: 18 },
      { planks: 12, stone: 8, coins: 50 },
      { ironIngot: 8, planks: 14, coins: 130 },
      { gears: 6, ironIngot: 12, coins: 290 },
      { etherCryst: 4, gears: 8, coins: 580 }
    ],
    effectText: (lvl: number) => {
      const caps = [10, 16, 24, 34, 46, 60];
      return `${caps[lvl]} → ${caps[lvl + 1]} espaços na mochila`;
    }
  },
  {
    id: 'lightBoots',
    category: 'capacity',
    name: 'Botas de Explorador',
    desc: 'Aumenta a velocidade de movimento e evita lentidão quando a mochila está cheia.',
    maxLevel: 4,
    costs: [
      { planks: 4, coins: 25 },
      { ironIngot: 5, coins: 70 },
      { gears: 4, coins: 180 },
      { steamCore: 2, coins: 360 }
    ],
    effectText: (lvl: number) => `+${lvl * 10}% → +${(lvl + 1) * 10}% Velocidade`
  },

  // --- EFICIÊNCIA ---
  {
    id: 'stationSpeed',
    category: 'efficiency',
    name: 'Polias & Transmissão',
    desc: 'Acelera todas as máquinas de processamento (Serraria, Fornalha e Oficina de Engrenagens).',
    maxLevel: 4,
    costs: [
      { planks: 6, coins: 30 },
      { ironIngot: 7, coins: 90 },
      { gears: 5, blueprints: 1, coins: 220 },
      { steamCore: 3, coins: 460 }
    ],
    effectText: (lvl: number) => `+${lvl * 25}% → +${(lvl + 1) * 25}% Produção`
  },
  {
    id: 'doubleYield',
    category: 'efficiency',
    name: 'Refino Sem Desperdício',
    desc: 'Chance de produzir +1 item processado bônus sem consumir matéria-prima extra.',
    maxLevel: 4,
    costs: [
      { planks: 8, coins: 40 },
      { ironIngot: 8, blueprints: 1, coins: 110 },
      { gears: 6, blueprints: 2, coins: 260 },
      { etherCryst: 4, coins: 520 }
    ],
    effectText: (lvl: number) => `${lvl * 12}% → ${(lvl + 1) * 12}% Item Bônus`
  },
  {
    id: 'merchantFavor',
    category: 'efficiency',
    name: 'Carta de Crédito do Vale',
    desc: 'Aumenta as Moedas ganhas nas vendas da Banca do Mercador e nos Contratos.',
    maxLevel: 4,
    costs: [
      { planks: 6, coins: 45 },
      { ironIngot: 6, coins: 120 },
      { gears: 5, coins: 280 },
      { etherCryst: 3, coins: 550 }
    ],
    effectText: (lvl: number) => `+${lvl * 15}% → +${(lvl + 1) * 15}% Moedas`
  },

  // --- AUTOMAÇÃO ---
  {
    id: 'autoMachines',
    category: 'automation',
    name: 'Alimentador Automático de Máquinas',
    desc: 'Serraria, Fornalha e Oficina de Engrenagens passam a produzir continuamente usando seu estoque, mesmo à distância.',
    maxLevel: 1,
    costs: [
      { ironIngot: 10, planks: 14, coins: 140 }
    ],
    effectText: () => 'Máquinas 100% Autônomas'
  },
  {
    id: 'lumberDrone',
    category: 'automation',
    name: 'Drone Lenhador a Vapor',
    desc: 'Libera um drone autônomo que corta árvores e entrega Madeira no seu estoque. (Requer Estação de Drones construída)',
    maxLevel: 3,
    requiresBuild: 'droneStation',
    costs: [
      { gears: 3, ironIngot: 8, coins: 180 },
      { gears: 6, steamCore: 1, coins: 360 },
      { gears: 10, etherCryst: 2, coins: 680 }
    ],
    effectText: (lvl: number) => `${lvl} → ${lvl + 1} Drone(s) Lenhador`
  },
  {
    id: 'minerDrone',
    category: 'automation',
    name: 'Drone Minerador a Vapor',
    desc: 'Libera um drone autônomo que extrai Pedra, Ferro e Cristal Etéreo automaticamente. (Requer Estação de Drones)',
    maxLevel: 3,
    requiresBuild: 'droneStation',
    costs: [
      { gears: 4, ironIngot: 10, coins: 220 },
      { gears: 8, steamCore: 2, coins: 440 },
      { gears: 12, etherCryst: 3, coins: 780 }
    ],
    effectText: (lvl: number) => `${lvl} → ${lvl + 1} Drone(s) Minerador`
  },

  // --- ESPECIAIS & ESPECIALIZAÇÃO ---
  {
    id: 'steamDash',
    category: 'special',
    name: 'Propulsor de Dash a Vapor',
    desc: 'Reduz recarga do Dash [Shift] e coleta recursos frágeis pelo caminho durante o impulso.',
    maxLevel: 1,
    costs: [
      { ironIngot: 6, planks: 10, coins: 95 }
    ],
    effectText: () => 'Dash Colhe & Recarrega Rápido'
  },
  {
    id: 'magnetCoil',
    category: 'special',
    name: 'Bobina Magnética de Coleta',
    desc: 'Atrai automaticamente todos os recursos derrubados num raio amplo ao redor do personagem.',
    maxLevel: 3,
    costs: [
      { planks: 8, coins: 40 },
      { ironIngot: 8, coins: 125 },
      { gears: 6, steamCore: 1, coins: 310 }
    ],
    effectText: (lvl: number) => `Raio Magnético ${85 + lvl * 55}px → ${85 + (lvl + 1) * 55}px`
  },
  {
    id: 'relicCelestialCore',
    category: 'special',
    name: 'Relíquia: Coração Celeste',
    desc: 'Artefato Supremo forjado com Relíquias da Cidadela Celeste. Dobra toda coleta manual e velocidade dos drones!',
    maxLevel: 1,
    costs: [
      { relic: 1, etherCryst: 4, coins: 900 }
    ],
    effectText: () => 'Maestria Suprema do Vale'
  }
];
