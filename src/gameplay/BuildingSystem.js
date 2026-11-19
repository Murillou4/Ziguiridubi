import { BLUEPRINTS_DEF } from '../config/buildings.js';

export class BuildingSystem {
  constructor(inventorySystem, eventBus) {
    this.inventorySystem = inventorySystem;
    this.eventBus = eventBus;
    this.blueprints = BLUEPRINTS_DEF;
  }

  getBlueprintProgressPct(bp, state) {
    const buildState = state.builds[bp.id];
    if (!buildState) return 0;
    if (buildState.built) return 100;

    let totalReq = 0;
    let totalPaid = 0;
    for (const [res, amt] of Object.entries(bp.cost)) {
      totalReq += amt;
      totalPaid += Math.min(amt, buildState.paid[res] || 0);
    }
    return totalReq > 0 ? Math.round((totalPaid / totalReq) * 100) : 0;
  }

  getNearbyBlueprint(playerX, playerY, state) {
    let closest = null;
    let bestDist = 115;

    for (const bp of this.blueprints) {
      if (state.builds[bp.id]?.built) continue;
      const cx = bp.x + bp.w / 2;
      const cy = bp.y + bp.h / 2;
      const d = Math.hypot(playerX - cx, playerY - cy);
      if (d < bestDist) {
        bestDist = d;
        closest = bp;
      }
    }

    return closest;
  }

  interactWithBlueprint(bpId, state, player) {
    const bp = this.blueprints.find(b => b.id === bpId);
    if (!bp) return { success: false, completed: false, depositedAny: false };

    const buildState = state.builds[bpId];
    if (!buildState || buildState.built) {
      return { success: false, completed: false, depositedAny: false };
    }

    let depositedAny = false;
    let allComplete = true;

    for (const [res, totalNeeded] of Object.entries(bp.cost)) {
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
      this.eventBus.emit('sound:hammer');
      this.eventBus.emit('fx:shake', { magnitude: 4 });
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
      this.eventBus.emit('fx:shake', { magnitude: 8 });
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
