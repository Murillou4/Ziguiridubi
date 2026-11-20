import { DerivedStats, GameState, PlayerState } from '../domain/types.ts';
import { InventorySystem } from './InventorySystem.ts';
import { EventBus } from '../core/EventBus.ts';
import { MACHINE_RECIPES, type MachineId } from '../config/machines.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';

const machineRecipes = Object.values(MACHINE_RECIPES);

export class MachineSystem {
  constructor(
    private inventorySystem: InventorySystem,
    private eventBus: EventBus
  ) {}

  hasProductionControls(state: GameState): boolean {
    return (state.upgrades.autoMachines ?? 0) > 0;
  }

  setPaused(state: GameState, id: MachineId, paused: boolean): boolean {
    const machine = state.machines[id];
    if (!this.hasProductionControls(state) || !state.builds[id]?.built || !machine) return false;
    if ((machine.paused === true) === paused) return false;

    machine.paused = paused;
    this.eventBus.emit('save:request', { silent: false });
    return true;
  }

  update(state: GameState, player: PlayerState, stats: DerivedStats, dt: number): void {
    const remote = this.hasProductionControls(state) || state.specialization === 'automataEngineer';

    for (const recipe of machineRecipes) {
      const machine = state.machines[recipe.id];
      if (!state.builds[recipe.id]?.built || !machine || machine.paused === true) continue;

      const blueprint = BLUEPRINTS_DEF.find(bp => bp.id === recipe.id)!;
      const cx = blueprint.x + blueprint.w / 2;
      const cy = blueprint.y + blueprint.h / 2;
      if (!remote && Math.hypot(player.x - cx, player.y - cy) >= 95) continue;
      if (!this.inventorySystem.canAfford(state, player, recipe.inputs)) continue;

      machine.progress += recipe.baseRate * stats.stationSpeedMult * dt;
      if (machine.progress < 1 || !this.inventorySystem.spendCost(state, player, recipe.inputs)) continue;

      machine.progress = 0;
      const bonus = Math.random() < stats.doubleYieldChance;
      const output = bonus ? 2 : 1;
      const resource = recipe.outputResource;
      state.storage[resource] = (state.storage[resource] || 0) + output;

      this.eventBus.emit('fx:floatingText', {
        x: cx,
        y: blueprint.y - 12,
        text: `+${output} ${recipe.floatText}${bonus ? ' ★' : ''}`,
        color: recipe.floatColor
      });
      this.eventBus.emit('fx:burst', { x: cx, y: cy, color: recipe.burstColor, count: recipe.burstCount });
    }
  }
}
