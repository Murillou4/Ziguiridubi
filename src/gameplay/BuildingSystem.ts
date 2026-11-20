import { GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { BLUEPRINTS_DEF, BlueprintConfig, getBlueprintDistance } from '../config/buildings.ts';
import { InventorySystem } from './InventorySystem.ts';
import { EventBus } from '../core/EventBus.ts';

export class BuildingSystem {
  public blueprints: BlueprintConfig[] = BLUEPRINTS_DEF;

  constructor(
    private inventorySystem: InventorySystem,
    private eventBus: EventBus
  ) {}

  getBlueprintProgressPct(bp: BlueprintConfig, state: GameState): number {
    return Math.round(this.getBlueprintProgress(bp, state) * 100);
  }

  getBlueprintProgress(bp: BlueprintConfig, state: GameState): number {
    const buildState = state.builds[bp.id];
    if (!buildState) return 0;
    if (buildState.built) return 1;

    let totalReq = 0;
    let totalPaid = 0;
    for (const [res, amt] of Object.entries(bp.cost) as [ResourceId, number][]) {
      totalReq += amt;
      totalPaid += Math.max(0, Math.min(amt, buildState.paid?.[res] ?? 0));
    }
    return totalReq > 0 ? totalPaid / totalReq : 0;
  }

  getNearbyBlueprint(playerX: number, playerY: number, state: GameState): BlueprintConfig | null {
    let closest: BlueprintConfig | null = null;
    let bestDist = 115;

    for (const bp of this.blueprints) {
      if (state.builds[bp.id]?.built) continue;
      const d = getBlueprintDistance(bp, playerX, playerY);
      if (d < bestDist) {
        bestDist = d;
        closest = bp;
      }
    }

    return closest;
  }

  interactWithBlueprint(
    bpId: string,
    state: GameState,
    player: PlayerState
  ): { success: boolean; completed: boolean; depositedAny: boolean } {
    const bp = this.blueprints.find(b => b.id === bpId);
    if (!bp) return { success: false, completed: false, depositedAny: false };

    const buildState = state.builds[bpId];
    if (!buildState || buildState.built || (bp.requiresBuild && !state.builds[bp.requiresBuild]?.built)) {
      return { success: false, completed: false, depositedAny: false };
    }

    let depositedAny = false;
    let allComplete = true;

    for (const [res, totalNeeded] of Object.entries(bp.cost) as [ResourceId, number][]) {
      const alreadyPaid = buildState.paid[res] || 0;
      const stillMissing = totalNeeded - alreadyPaid;

      if (stillMissing > 0) {
        const available = this.inventorySystem.getTotalResource(state, player, res);
        const toPay = Math.min(stillMissing, available);

        if (toPay > 0) {
          this.inventorySystem.consumeResource(state, player, res, toPay);
          buildState.paid[res] = alreadyPaid + toPay;
          depositedAny = true;
        }

        if ((buildState.paid[res] || 0) < totalNeeded) {
          allComplete = false;
        }
      }
    }

    const cx = bp.x + bp.w / 2;
    const cy = bp.y + bp.h / 2;

    if (depositedAny) {
      this.eventBus.emit('building:deposited', bpId);
      this.eventBus.emit('sound:hammer');
      this.eventBus.emit('fx:burst', { x: cx, y: cy, color: '#fde047', count: 16 });
      this.eventBus.emit('fx:floatingText', {
        x: cx,
        y: cy - 22,
        text: '🔨 Materiais Depositados!',
        color: '#fde047'
      });
    } else if (!allComplete) {
      this.eventBus.emit('ui:toast', {
        message: '⚠️ Colete ou venda recursos na Banca do Mercador para completar esta obra.'
      });
      return { success: false, completed: false, depositedAny: false };
    }

    if (allComplete) {
      buildState.built = true;
      this.eventBus.emit('sound:upgrade');
      this.eventBus.emit('fx:burst', { x: cx, y: cy, color: '#4ade80', count: 28 });

      if (bp.advanceToPhase && bp.advanceToPhase > state.phase) {
        state.phase = bp.advanceToPhase;
        this.eventBus.emit('phase:advanced', { phase: state.phase });
      }

      if (bp.nextTrackedBuildId !== undefined) {
        state.trackedBuildId = bp.nextTrackedBuildId;
      }

      if (bp.completionToast) {
        this.eventBus.emit('ui:toast', { message: bp.completionToast });
      }

      this.eventBus.emit('save:request', { silent: false });
      this.eventBus.emit('ui:refresh');
      return { success: true, completed: true, depositedAny };
    } else {
      this.eventBus.emit('save:request', { silent: true });
      this.eventBus.emit('ui:hud');
      return { success: true, completed: false, depositedAny };
    }
  }
}
