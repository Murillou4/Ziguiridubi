import { BASE_CONTRACT_TEMPLATES } from '../config/contracts.js';

export class ContractSystem {
  constructor(inventorySystem, eventBus) {
    this.inventorySystem = inventorySystem;
    this.eventBus = eventBus;
  }

  generateContracts(phase) {
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

  completeContract(state, player, contractId, stats) {
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

    state.contracts.splice(idx, 1);
    const remaining = [...state.contracts];
    const newBatch = this.generateContracts(state.phase);
    const replacement = newBatch.find(nb => !remaining.some(r => r.title === nb.title)) || newBatch[0];
    state.contracts = [...remaining, replacement].slice(0, 3);

    this.eventBus.emit('save:request', { silent: false });
    this.eventBus.emit('ui:hud');

    return { success: true, coins, blueprints: ct.blueprints };
  }
}
