import { GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';
import { PHASES_INFO } from '../config/phases.ts';
import { resourceIcon } from './resource-icon.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { EventBus } from '../core/EventBus.ts';

export class ProjectsModal {
  constructor(
    private inventorySystem: InventorySystem,
    private eventBus: EventBus
  ) {}

  render(state: GameState, player: PlayerState): void {
    const grid = document.getElementById('projectsGrid');
    if (grid) {
      grid.innerHTML = BLUEPRINTS_DEF.map(bp => {
        const st = state.builds[bp.id];
        const built = Boolean(st?.built);
        const isTracked = state.trackedBuildId === bp.id;

        const costHtml = Object.entries(bp.cost).map(([resKey, amt]) => {
          const res = resKey as ResourceId;
          const paid = st?.paid[res] || 0;
          const have = this.inventorySystem.getTotalResource(state, player, res);
          const total = built ? (amt || 0) : Math.min(amt || 0, paid + have);
          return `<span class="px-2 py-0.5 rounded-lg text-[11px] ${
            total >= (amt || 0)
              ? 'ui-fill-moss ui-ink-moss'
              : 'ui-fill-inset ui-ink-muted'
          }">${resourceIcon(res)} ${total}/${amt}</span>`;
        }).join(' ');

        return `
          <div class="rounded-2xl p-4 border flex flex-col justify-between gap-2.5 ${
            built
              ? 'ui-fill-moss ui-edge-moss'
              : isTracked
              ? 'ui-fill-sand ui-edge-honey'
              : 'ui-fill-light ui-edge'
          }">
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-bold ${built ? 'ui-ink-moss' : 'ui-ink-honey'}">${bp.name}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  built
                    ? 'ui-fill-moss ui-ink-moss'
                    : 'ui-fill-sand ui-ink-honey'
                }">${built ? 'Concluído ✓' : 'Zona Amarela'}</span>
              </div>
              <p class="text-xs ui-ink-muted mt-1">${bp.desc}</p>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t ui-edge">
              <div class="flex flex-wrap gap-1">${costHtml}</div>
              ${
                !built
                  ? `
                <button data-track-bp="${bp.id}" class="px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition ${
                      isTracked
                        ? 'ui-fill-honey ui-ink'
                        : 'ui-fill-light ui-hover-light ui-ink-honey'
                    }">
                  ${isTracked ? ' Rastreando' : 'Rastrear Projeto'}
                </button>
              `
                  : ''
              }
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('[data-track-bp]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.trackedBuildId = btn.getAttribute('data-track-bp');
          this.eventBus.emit('ui:hud');
          this.render(state, player);
          this.eventBus.emit('ui:toast', {
            message: ' Seta guia dourada apontando para o projeto selecionado!'
          });
        });
      });
    }

    const phasesEl = document.getElementById('phasesGrid');
    if (phasesEl) {
      phasesEl.innerHTML = PHASES_INFO.map(pi => {
        const done = state.phase > pi.phase;
        const cur = state.phase === pi.phase;
        return `
          <div class="rounded-2xl p-3 border ${
            cur
              ? 'ui-fill-sand ui-edge-honey'
              : done
              ? 'ui-fill-moss ui-edge-moss'
              : 'ui-fill-inset ui-edge'
          }">
            <div class="text-xs font-bold ${
              cur ? 'ui-ink-honey' : done ? 'ui-ink-moss' : 'ui-ink-muted'
            }">${pi.title}</div>
            <p class="text-[11px] ui-ink-muted mt-1 leading-snug">${pi.desc}</p>
          </div>
        `;
      }).join('');
    }
  }
}
