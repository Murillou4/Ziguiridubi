import { GameState, PlayerState, UpgradeDef } from '../domain/types.ts';
import { UPGRADES_DEF } from '../config/upgrades.ts';
import { InventorySystem } from './InventorySystem.ts';
import { EventBus } from '../core/EventBus.ts';

export class UpgradeSystem {
  public upgrades: UpgradeDef[] = UPGRADES_DEF;

  constructor(
    private inventorySystem: InventorySystem,
    private eventBus: EventBus
  ) {}

  missingBuild(state: GameState, def: UpgradeDef): string | undefined {
    const required = typeof def.requiresBuild === 'string' ? [def.requiresBuild] : def.requiresBuild;
    return required?.find(id => !state.builds[id]?.built);
  }

  canBuy(state: GameState, player: PlayerState, upgradeId: string): boolean {
    const def = this.upgrades.find(u => u.id === upgradeId);
    if (!def) return false;
    const cur = state.upgrades[upgradeId] || 0;
    if (cur >= def.maxLevel) return false;
    if (this.missingBuild(state, def)) return false;

    const cost = def.costs[cur];
    return this.inventorySystem.canAfford(state, player, cost);
  }

  buyUpgrade(state: GameState, player: PlayerState, upgradeId: string): boolean {
    const def = this.upgrades.find(u => u.id === upgradeId);
    if (!def) return false;

    const cur = state.upgrades[upgradeId] || 0;
    if (cur >= def.maxLevel) return false;
    if (this.missingBuild(state, def)) return false;

    const cost = def.costs[cur];
    if (!this.inventorySystem.canAfford(state, player, cost)) return false;

    this.inventorySystem.spendCost(state, player, cost);
    state.upgrades[upgradeId] = cur + 1;

    this.eventBus.emit('sound:upgrade');
    this.eventBus.emit('upgrade:purchased', { id: upgradeId, level: state.upgrades[upgradeId] });
    this.eventBus.emit('ui:toast', { message: `Melhoria adquirida: ${def.name}` });
    this.eventBus.emit('save:request', { silent: false });
    this.eventBus.emit('ui:refresh');

    return true;
  }
}
