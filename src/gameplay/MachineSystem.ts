import { DerivedStats, GameState, PlayerState } from '../domain/types.ts';
import { InventorySystem } from './InventorySystem.ts';
import { EventBus } from '../core/EventBus.ts';
import { MACHINE_RECIPES } from '../config/machines.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';

export class MachineSystem {
  constructor(
    private inventorySystem: InventorySystem,
    private eventBus: EventBus
  ) {}

  update(
    state: GameState,
    player: PlayerState,
    stats: DerivedStats,
    dt: number
  ): void {
    const autoAll =
      (state.upgrades.autoMachines ?? 0) > 0 ||
      state.specialization === 'automataEngineer';

    // 1. Serraria Manual: 2 Madeira -> 1 Tábua
    if (state.builds.sawmill?.built) {
      const bp = BLUEPRINTS_DEF.find(b => b.id === 'sawmill')!;
      const cx = bp.x + bp.w / 2;
      const cy = bp.y + bp.h / 2;
      const near = Math.hypot(player.x - cx, player.y - cy) < 95;

      if (this.inventorySystem.getTotalResource(state, player, 'wood') >= 2 && (near || autoAll)) {
        state.machines.sawmill.progress += 0.55 * stats.stationSpeedMult * dt;
        if (state.machines.sawmill.progress >= 1) {
          state.machines.sawmill.progress = 0;
          this.inventorySystem.consumeResource(state, player, 'wood', 2);
          const bonus = Math.random() < stats.doubleYieldChance ? 1 : 0;
          const out = 1 + bonus;
          state.storage.planks = (state.storage.planks || 0) + out;

          this.eventBus.emit('fx:floatingText', {
            x: cx,
            y: bp.y - 12,
            text: `+${out} Tábua${bonus ? ' ★' : ''}`,
            color: '#fcd34d'
          });
          this.eventBus.emit('fx:burst', { x: cx, y: cy, color: '#dca058', count: 8 });
        }
      }
    }

    // 2. Fornalha de Pedra: 2 Minério de Ferro -> 1 Lingote de Ferro
    if (state.builds.furnace?.built) {
      const bp = BLUEPRINTS_DEF.find(b => b.id === 'furnace')!;
      const cx = bp.x + bp.w / 2;
      const cy = bp.y + bp.h / 2;
      const near = Math.hypot(player.x - cx, player.y - cy) < 95;

      if (this.inventorySystem.getTotalResource(state, player, 'ironOre') >= 2 && (near || autoAll)) {
        state.machines.furnace.progress += 0.45 * stats.stationSpeedMult * dt;
        if (state.machines.furnace.progress >= 1) {
          state.machines.furnace.progress = 0;
          this.inventorySystem.consumeResource(state, player, 'ironOre', 2);
          const bonus = Math.random() < stats.doubleYieldChance ? 1 : 0;
          const out = 1 + bonus;
          state.storage.ironIngot = (state.storage.ironIngot || 0) + out;

          this.eventBus.emit('fx:floatingText', {
            x: cx,
            y: bp.y - 12,
            text: `+${out} Lingote${bonus ? ' ★' : ''}`,
            color: '#e2e8f0'
          });
          this.eventBus.emit('fx:burst', { x: cx, y: cy, color: '#f97316', count: 9 });
        }
      }
    }

    // 3. Oficina de Engrenagens: 2 Lingotes de Ferro + 2 Tábuas -> 1 Engrenagem
    if (state.builds.gearWorkshop?.built) {
      const bp = BLUEPRINTS_DEF.find(b => b.id === 'gearWorkshop')!;
      const cx = bp.x + bp.w / 2;
      const cy = bp.y + bp.h / 2;
      const near = Math.hypot(player.x - cx, player.y - cy) < 95;

      if (
        this.inventorySystem.getTotalResource(state, player, 'ironIngot') >= 2 &&
        this.inventorySystem.getTotalResource(state, player, 'planks') >= 2 &&
        (near || autoAll)
      ) {
        state.machines.gearWorkshop.progress += 0.38 * stats.stationSpeedMult * dt;
        if (state.machines.gearWorkshop.progress >= 1) {
          state.machines.gearWorkshop.progress = 0;
          this.inventorySystem.consumeResource(state, player, 'ironIngot', 2);
          this.inventorySystem.consumeResource(state, player, 'planks', 2);
          const bonus = Math.random() < stats.doubleYieldChance ? 1 : 0;
          const out = 1 + bonus;
          state.storage.gears = (state.storage.gears || 0) + out;

          this.eventBus.emit('fx:floatingText', {
            x: cx,
            y: bp.y - 12,
            text: `+${out} Engrenagem${bonus ? ' ★' : ''}`,
            color: '#fbbf24'
          });
          this.eventBus.emit('fx:burst', { x: cx, y: cy, color: '#f59e0b', count: 10 });
        }
      }
    }
  }
}
