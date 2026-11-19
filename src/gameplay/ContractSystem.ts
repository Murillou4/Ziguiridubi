import { Contract, DerivedStats, GameState, PlayerState } from '../domain/types.ts';
import { BASE_CONTRACT_TEMPLATES } from '../config/contracts.ts';
import { InventorySystem } from './InventorySystem.ts';
import { EventBus } from '../core/EventBus.ts';

export class ContractSystem {
  constructor(
    private inventorySystem: InventorySystem,
    private eventBus: EventBus
  ) {}

  generateContracts(phase: number): Contract[] {
    const available = BASE_CONTRACT_TEMPLATES.filter(
      t => !t.minPhase || phase >= t.minPhase
    );

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(t => ({
      id: 'ct_' + Math.random().toString(36).slice(2, 7),
      title: t.title,
      req: { ...t.req },
      coins: t.coins,
      blueprints: t.blueprints
    }));
  }

  completeContract(
    state: GameState,
    player: PlayerState,
    contractId: string,
    stats: DerivedStats
  ): { success: boolean; coins: number; blueprints: number } {
    const idx = state.contracts.findIndex(c => c.id === contractId);
    if (idx === -1) return { success: false, coins: 0, blueprints: 0 };

    const ct = state.contracts[idx];
    if (!this.inventorySystem.canAfford(state, player, ct.req)) {
      return { success: false, coins: 0, blueprints: 0 };
    }

    this.inventorySystem.spendCost(state, player, ct.req);
    const coins = Math.round(ct.coins * stats.merchantMult);
    state.storage.coins = (state.storage.coins || 0) + coins;
    state.storage.blueprints = (state.storage.blueprints || 0) + ct.blueprints;
    state.stats.coinsEarned += coins;

    this.eventBus.emit('sound:upgrade');
    this.eventBus.emit('ui:toast', {
      message: `📜 Contrato entregue! +${coins} Moedas e +${ct.blueprints} Planta(s) Técnica(s)!`
    });

    // Repõe 1 novo contrato mantendo os 2 restantes
    state.contracts.splice(idx, 1);
    const remaining = [...state.contracts];
    const newBatch = this.generateContracts(state.phase);
    // Adiciona o primeiro que não esteja entre os remanescentes
    const replacement = newBatch.find(nb => !remaining.some(r => r.title === nb.title)) || newBatch[0];
    state.contracts = [...remaining, replacement].slice(0, 3);

    this.eventBus.emit('save:request', { silent: false });
    this.eventBus.emit('ui:hud');

    return { success: true, coins, blueprints: ct.blueprints };
  }
}
