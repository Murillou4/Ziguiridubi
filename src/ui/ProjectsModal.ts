import { GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';
import { PHASES_INFO } from '../config/phases.ts';
import { RESOURCES } from '../config/resources.ts';
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
          const def = RESOURCES[res];
          const paid = st?.paid[res] || 0;
          const have = this.inventorySystem.getTotalResource(state, player, res);
          const total = built ? (amt || 0) : Math.min(amt || 0, paid + have);
          return `<span class="px-2 py-0.5 rounded-lg text-[11px] ${
            total >= (amt || 0)
              ? 'bg-emerald-950/80 text-emerald-200'
              : 'bg-stone-800 text-stone-300'
          }">${def ? def.icon : ''} ${total}/${amt}</span>`;
        }).join(' ');

        return `
          <div class="rounded-2xl p-4 border flex flex-col justify-between gap-2.5 ${
            built
              ? 'bg-emerald-950/25 border-emerald-500/30'
              : isTracked
              ? 'bg-yellow-500/12 border-yellow-400/60'
              : 'bg-black/30 border-stone-800'
          }">
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-bold ${built ? 'text-emerald-300' : 'text-yellow-200'}">${bp.name}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  built
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'bg-yellow-400/20 text-yellow-200'
                }">${built ? 'Concluído ✓' : 'Zona Amarela'}</span>
              </div>
              <p class="text-xs text-stone-300 mt-1">${bp.desc}</p>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-800">
              <div class="flex flex-wrap gap-1">${costHtml}</div>
              ${
                !built
                  ? `
                <button data-track-bp="${bp.id}" class="px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition ${
                      isTracked
                        ? 'bg-yellow-400 text-stone-950'
                        : 'bg-white/10 hover:bg-white/20 text-yellow-200'
                    }">
                  ${isTracked ? '🧭 Rastreando' : 'Rastrear Projeto'}
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
            message: '🧭 Seta guia dourada apontando para o projeto selecionado!'
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
              ? 'bg-amber-500/15 border-amber-400/50'
              : done
              ? 'bg-emerald-950/25 border-emerald-500/30'
              : 'bg-black/25 border-stone-800 opacity-65'
          }">
            <div class="text-xs font-bold ${
              cur ? 'text-amber-200' : done ? 'text-emerald-300' : 'text-stone-400'
            }">${pi.title}</div>
            <p class="text-[11px] text-stone-300 mt-1 leading-snug">${pi.desc}</p>
          </div>
        `;
      }).join('');
    }
  }
}
