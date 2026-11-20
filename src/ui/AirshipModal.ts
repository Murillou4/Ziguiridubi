import { DerivedStats, GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { AIRSHIP_ROUTES } from '../config/airshipRoutes.ts';
import { RESOURCES } from '../config/resources.ts';
import { resourceIcon } from './resource-icon.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { AirshipSystem } from '../gameplay/AirshipSystem.ts';

export class AirshipModal {
  constructor(
    private inventorySystem: InventorySystem,
    private airshipSystem: AirshipSystem
  ) {}

  render(state: GameState, player: PlayerState, stats: DerivedStats): void {
    const air = state.airship;
    const statusBox = document.getElementById('airshipStatusBox');
    if (!statusBox) return;

    if (air.activeRouteId) {
      const route = AIRSHIP_ROUTES.find(r => r.id === air.activeRouteId);
      const pct = Math.min(100, Math.round((air.elapsed / Math.max(1, air.duration)) * 100));
      const rem = Math.max(0, Math.ceil(air.duration - air.elapsed));

      statusBox.innerHTML = `
        <div class="flex-1 w-full">
          <div class="flex items-center justify-between text-xs font-bold mb-1.5">
            <span class="ui-ink-honey"> Expedição: ${route?.name}</span>
            <span class="ui-ink-moss">${
              air.completed ? 'Dirigível Atracado — Pronto!' : `Retorna em ${rem}s (${pct}%)`
            }</span>
          </div>
          <div class="w-full h-2.5 ui-fill-inset rounded-full overflow-hidden">
            <div class="h-full ui-fill-moss transition-all duration-200" style="width: ${pct}%"></div>
          </div>
        </div>
        ${
          air.completed
            ? `
          <button id="btnCollectAirshipModal" class="px-5 py-2.5 rounded-xl ui-fill-moss ui-hover-moss ui-ink font-bold text-xs cursor-pointer shadow">
             Coletar Recompensas
          </button>
        `
            : ''
        }
      `;

      const btn = document.getElementById('btnCollectAirshipModal');
      if (btn) {
        btn.addEventListener('click', () => {
          this.airshipSystem.collectRewards(state, stats);
          this.render(state, player, stats);
        });
      }
    } else {
      statusBox.innerHTML = `
        <div class="text-xs ui-ink flex items-center gap-2.5">
          <span class="route-marker">DOCA</span>
          <div>
            <div class="font-bold ui-ink-moss">Dirigível Atracado e Pronto para Decolar</div>
            <div class="ui-ink-muted">Escolha uma das 3 rotas aéreas abaixo para enviar cargas processadas.</div>
          </div>
        </div>
      `;
    }

    const routesGrid = document.getElementById('airshipRoutesGrid');
    if (!routesGrid) return;

    routesGrid.innerHTML = AIRSHIP_ROUTES.map(r => {
      const canLaunch = !air.activeRouteId && this.inventorySystem.canAfford(state, player, r.cost);
      const dur = Math.max(10, Math.round(r.duration / stats.airshipSpeedMult));

      const costHtml = Object.entries(r.cost).map(([resKey, amt]) => {
        const res = resKey as ResourceId;
        const have = this.inventorySystem.getTotalResource(state, player, res);
        const ok = have >= (amt || 0);
        return `<span class="px-2 py-0.5 rounded-lg text-xs ${
          ok ? 'ui-fill-moss ui-ink-moss' : 'ui-fill-clay ui-ink-clay'
        }">${resourceIcon(res)} ${have}/${amt}</span>`;
      }).join(' ');

      const rewHtml = Object.entries(r.rewards).map(([resKey, amt]) => {
        const res = resKey as ResourceId;
        const def = RESOURCES[res];
        const val = res === 'coins' ? Math.round((amt || 0) * stats.airshipRewardMult) : (amt || 0);
        return `<span class="px-2 py-0.5 rounded-lg text-xs ui-fill-sand ui-ink-honey border ui-edge-honey font-semibold">${resourceIcon(res, true)} +${val} ${def.name}</span>`;
      }).join(' ');

      return `
        <div class="rounded-2xl p-4 ui-fill-light border ui-edge flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <h3 class="text-sm font-bold ui-ink">${r.name}</h3>
              <span class="text-xs font-semibold ui-ink-sky"> ${dur}s</span>
            </div>
            <p class="text-xs ui-ink-muted leading-relaxed mb-3">${r.desc}</p>

            <div class="text-[11px] font-bold ui-ink-muted uppercase mb-1">Carga Necessária:</div>
            <div class="flex flex-wrap gap-1.5 mb-3">${costHtml}</div>

            <div class="text-[11px] font-bold ui-ink-honey uppercase mb-1">Recompensa:</div>
            <div class="flex flex-wrap gap-1.5">${rewHtml}</div>
          </div>

          <button data-launch-route="${r.id}" ${!canLaunch ? 'disabled' : ''} class="w-full py-2.5 rounded-xl text-xs font-bold transition ${
        canLaunch
          ? 'ui-fill-moss ui-hover-moss ui-ink cursor-pointer active:scale-95 shadow'
          : 'ui-fill-inset ui-ink-muted cursor-not-allowed'
      }">
            ${
              air.activeRouteId
                ? 'Dirigível em Viagem'
                : canLaunch
                ? ' Iniciar Expedição'
                : 'Carga Insuficiente'
            }
          </button>
        </div>
      `;
    }).join('');

    routesGrid.querySelectorAll('[data-launch-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        const routeId = btn.getAttribute('data-launch-route')!;
        this.airshipSystem.launchRoute(state, player, routeId, stats);
        this.render(state, player, stats);
      });
    });
  }
}
