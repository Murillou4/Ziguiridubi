import { AIRSHIP_ROUTES } from '../config/airshipRoutes.js';

export class AirshipSystem {
  constructor(inventorySystem, eventBus) {
    this.inventorySystem = inventorySystem;
    this.eventBus = eventBus;
    this.routes = AIRSHIP_ROUTES;
  }

  launchRoute(state, player, routeId, stats) {
    if (!state.builds.airshipDock?.built) return false;
    if (state.airship.activeRouteId) return false;

    const route = this.routes.find(r => r.id === routeId);
    if (!route || !this.inventorySystem.canAfford(state, player, route.cost)) {
      return false;
    }

    this.inventorySystem.spendCost(state, player, route.cost);
    const duration = Math.max(10, Math.round(route.duration / stats.airshipSpeedMult));

    state.airship = {
      activeRouteId: route.id,
      elapsed: 0,
      duration,
      completed: false
    };

    this.eventBus.emit('sound:horn');
    this.eventBus.emit('ui:toast', {
      message: `🎈 Dirigível decolou rumo à ${route.name} (${duration}s)!`
    });
    this.eventBus.emit('save:request', { silent: false });
    this.eventBus.emit('ui:hud');

    return true;
  }

  update(state, dt) {
    if (state.airship.activeRouteId && !state.airship.completed) {
      state.airship.elapsed += dt;
      if (state.airship.elapsed >= state.airship.duration) {
        state.airship.elapsed = state.airship.duration;
        state.airship.completed = true;

        this.eventBus.emit('sound:horn');
        this.eventBus.emit('ui:toast', {
          message: '🎈 O Dirigível retornou ao Cais com recompensas!'
        });
        return { justCompleted: true };
      }
    }
    return { justCompleted: false };
  }

  collectRewards(state, stats, onAdvancePhase) {
    const air = state.airship;
    if (!air.activeRouteId || !air.completed) return false;

    const route = this.routes.find(r => r.id === air.activeRouteId);
    if (route) {
      for (const [res, amt] of Object.entries(route.rewards)) {
        const finalAmt = res === 'coins' ? Math.round(amt * stats.airshipRewardMult) : amt;
        state.storage[res] = (state.storage[res] || 0) + finalAmt;
      }

      if (route.id === 'celestial_citadel' && onAdvancePhase) {
        onAdvancePhase(6);
      }
    }

    state.airship = {
      activeRouteId: null,
      elapsed: 0,
      duration: 0,
      completed: false
    };

    this.eventBus.emit('sound:upgrade');
    this.eventBus.emit('ui:toast', {
      message: '🎉 Expedição concluída! Recompensas descarregadas no Cais.'
    });
    this.eventBus.emit('save:request', { silent: false });
    this.eventBus.emit('ui:refresh');

    return true;
  }
}
