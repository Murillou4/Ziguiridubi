import { SpecializationDef } from '../domain/types.ts';

export const SPECIALIZATIONS: SpecializationDef[] = [
  {
    id: 'artisan',
    name: 'Artesão Mestre',
    icon: '🏺',
    tagline: 'Produção ultrarrápida e lucros máximos na Banca do Mercador.',
    bonuses: ['+60% velocidade nas máquinas', '+25% chance de item duplo', '+35% Moedas em vendas e contratos']
  },
  {
    id: 'airshipMagnate',
    name: 'Magnata Aéreo',
    icon: '🎈',
    tagline: 'Expedições do Cais do Dirigível muito mais rápidas e lucrativas.',
    bonuses: ['-35% tempo de viagem do Dirigível', '+35% Moedas nas expedições aéreas', '+20% velocidade de caminhada']
  },
  {
    id: 'automataEngineer',
    name: 'Engenheiro de Automação',
    icon: '🤖',
    tagline: 'Drones turbinados e raio magnético gigantesco em todo o arquipélago.',
    bonuses: ['+70% velocidade e carga dos Drones', '+80% alcance magnético de coleta', 'Aciona máquinas à distância']
  }
];
