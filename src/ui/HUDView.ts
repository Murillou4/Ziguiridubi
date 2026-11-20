import { DerivedStats, GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { RESOURCES } from '../config/resources.ts';
import { PHASES_INFO } from '../config/phases.ts';
import { AIRSHIP_ROUTES } from '../config/airshipRoutes.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { getResourceIconUrl } from './resource-icon.ts';

export class HUDView {
  constructor(private inventorySystem: InventorySystem) {}

  update(state: GameState, player: PlayerState, stats: DerivedStats): void {
    this.updateResourceBar(state, player);
    this.updateBackpackAndDash(player, stats);
    this.updateAirshipFlightBanner(state);
    this.updateObjectiveCard(state);
  }

  updateResourceBar(state: GameState, player: PlayerState): void {
    const resBar = document.getElementById('resourceBar');
    if (!resBar) return;

    for (const icon of document.querySelectorAll<HTMLImageElement>('img[data-hud-resource-icon]:not([src])')) {
      icon.src = getResourceIconUrl(icon.dataset.hudResourceIcon as ResourceId);
    }

    const keys: ResourceId[] = ['coins', 'wood', 'stone', 'planks'];

    if (
      state.builds.eastBridge?.built ||
      this.inventorySystem.getTotalResource(state, player, 'ironOre') > 0 ||
      this.inventorySystem.getTotalResource(state, player, 'ironIngot') > 0
    ) {
      keys.push('ironOre', 'ironIngot');
    }

    if (
      state.builds.gearWorkshop?.built ||
      this.inventorySystem.getTotalResource(state, player, 'gears') > 0
    ) {
      keys.push('gears');
    }

    if (
      state.builds.airshipDock?.built ||
      this.inventorySystem.getTotalResource(state, player, 'steamCore') > 0 ||
      this.inventorySystem.getTotalResource(state, player, 'etherCryst') > 0
    ) {
      keys.push('steamCore', 'etherCryst');
    }

    if (this.inventorySystem.getTotalResource(state, player, 'relic') > 0) {
      keys.push('relic');
    }

    resBar.innerHTML = keys.map(k => {
      const def = RESOURCES[k];
      const val = this.inventorySystem.getTotalResource(state, player, k);
      return `
        <div class="hud-resource" data-resource="${k}" title="${def.name}" aria-label="${def.name}: ${val}">
          <img src="${getResourceIconUrl(k)}" alt="" width="24" height="24">
          <span>${val}</span>
        </div>
      `;
    }).join('');
  }

  updateBackpackAndDash(player: PlayerState, stats: DerivedStats): void {
    const bpCount = player.backpack.length;
    const bpMax = stats.maxBackpack;

    const bpTextEl = document.getElementById('backpackText');
    if (bpTextEl) bpTextEl.textContent = `${bpCount}/${bpMax}`;

    const bpFillEl = document.getElementById('backpackFill');
    if (bpFillEl) {
      const bpPct = Math.min(100, Math.round((bpCount / Math.max(1, bpMax)) * 100));
      bpFillEl.style.width = `${bpPct}%`;
      bpFillEl.toggleAttribute('data-full', bpCount >= bpMax);
    }

    const dashEl = document.getElementById('hudDashStatus');
    if (dashEl) {
      if (player.dashCooldown > 0) {
        dashEl.textContent = `${player.dashCooldown.toFixed(1)}s`;
      } else {
        dashEl.textContent = 'Pronto';
      }
      dashEl.toggleAttribute('data-recharging', player.dashCooldown > 0);
    }
  }

  updateAirshipFlightBanner(state: GameState): void {
    const air = state.airship;
    const airBanner = document.getElementById('airshipFlightBanner');
    const airBtnHud = document.getElementById('btnCollectAirshipHud');
    if (!airBanner || !airBtnHud) return;

    if (air.activeRouteId) {
      const route = AIRSHIP_ROUTES.find(r => r.id === air.activeRouteId);
      const pct = Math.min(100, Math.round((air.elapsed / Math.max(1, air.duration)) * 100));
      const rem = Math.max(0, Math.ceil(air.duration - air.elapsed));

      airBanner.classList.remove('hidden');
      airBanner.classList.add('flex');

      const titleEl = document.getElementById('airshipFlightTitle');
      if (titleEl) {
        titleEl.textContent = air.completed
          ? ` ${route?.name || 'Dirigível'} — Retornou!`
          : ` ${route?.name || 'Expedição'} (${rem}s)`;
      }

      const fillEl = document.getElementById('airshipFlightFill');
      if (fillEl) fillEl.style.width = `${pct}%`;

      if (air.completed) {
        airBtnHud.classList.remove('hidden');
      } else {
        airBtnHud.classList.add('hidden');
      }
    } else {
      airBanner.classList.add('hidden');
      airBanner.classList.remove('flex');
      airBtnHud.classList.add('hidden');
    }
  }

  updateObjectiveCard(state: GameState): void {
    const phaseInfo = PHASES_INFO.find(p => p.phase === state.phase) || PHASES_INFO[0];
    const badgeEl = document.getElementById('phaseBadge');
    if (badgeEl) badgeEl.textContent = phaseInfo.title;

    const trackedId = state.trackedBuildId;
    const trackedBp = trackedId
      ? BLUEPRINTS_DEF.find(b => b.id === trackedId && !state.builds[b.id]?.built)
      : null;
    const nextUnbuilt = trackedBp || BLUEPRINTS_DEF.find(b => !state.builds[b.id]?.built);

    const titleEl = document.getElementById('objectiveTitle');
    const descEl = document.getElementById('objectiveDesc');

    if (nextUnbuilt) {
      if (titleEl) titleEl.textContent = nextUnbuilt.name;
      if (descEl) descEl.textContent = 'Siga a seta dourada e pressione E.';
    } else if ((state.upgrades.relicCelestialCore ?? 0) === 0) {
      if (titleEl) titleEl.textContent = 'Expedição: Cidadela Celeste';
      if (descEl) descEl.textContent = 'Lance o Dirigível para obter Relíquias e forjar o Coração Celeste.';
    } else {
      if (titleEl) titleEl.textContent = 'Maestria do Arquipélago';
      if (descEl) descEl.textContent = 'Todas as ilhas e relíquias conquistadas! Continue expandindo sua oficina.';
    }
  }
}
