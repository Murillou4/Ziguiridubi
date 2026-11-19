import { GameState, PlayerState, ResourceId, SpecializationId } from '../domain/types.ts';
import { UPGRADE_CATEGORIES, UPGRADES_DEF } from '../config/upgrades.ts';
import { SPECIALIZATIONS } from '../config/specializations.ts';
import { RESOURCES } from '../config/resources.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { UpgradeSystem } from '../gameplay/UpgradeSystem.ts';
import { ProgressionSystem } from '../gameplay/ProgressionSystem.ts';

export class WorkshopModal {
  public activeUpgradeTab: string = 'tools';

  constructor(
    private inventorySystem: InventorySystem,
    private upgradeSystem: UpgradeSystem,
    private progressionSystem: ProgressionSystem
  ) {}

  render(state: GameState, player: PlayerState): void {
    const tabsEl = document.getElementById('upgradeTabs');
    if (!tabsEl) return;

    const tabs = [...UPGRADE_CATEGORIES];
    if (state.phase >= 5) {
      tabs.push({ id: 'specialization' as any, label: 'Especialização', icon: '👑' });
    }

    tabsEl.innerHTML = tabs.map(t => {
      const active = this.activeUpgradeTab === t.id;
      return `
        <button data-upg-tab="${t.id}" class="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
          active
            ? 'bg-amber-400 text-stone-950 shadow'
            : 'bg-white/5 hover:bg-white/10 text-stone-300'
        }">
          <span>${t.icon}</span><span>${t.label}</span>
        </button>
      `;
    }).join('');

    tabsEl.querySelectorAll('[data-upg-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeUpgradeTab = btn.getAttribute('data-upg-tab')!;
        this.render(state, player);
      });
    });

    const listEl = document.getElementById('upgradeList');
    if (!listEl) return;

    if (this.activeUpgradeTab === 'specialization') {
      listEl.innerHTML = SPECIALIZATIONS.map(sp => {
        const active = state.specialization === sp.id;
        return `
          <div class="rounded-2xl p-4 border flex flex-col justify-between ${
            active ? 'bg-amber-500/15 border-amber-400' : 'bg-black/30 border-stone-800'
          }">
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-base font-bold text-stone-100">${sp.icon} ${sp.name}</span>
                ${
                  active
                    ? '<span class="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-bold">ATIVA</span>'
                    : ''
                }
              </div>
              <p class="text-xs text-stone-300 mb-3">${sp.tagline}</p>
              <ul class="space-y-1 text-xs text-emerald-200 mb-4">
                ${sp.bonuses.map(b => `<li>✦ ${b}</li>`).join('')}
              </ul>
            </div>
            <button data-spec-id="${sp.id}" class="w-full py-2 rounded-xl text-xs font-bold cursor-pointer ${
          active
            ? 'bg-stone-700 text-stone-300'
            : 'bg-amber-400 hover:bg-amber-300 text-stone-950'
        }">
              ${active ? 'Especialização Ativa' : 'Escolher Build'}
            </button>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('[data-spec-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const specId = btn.getAttribute('data-spec-id') as SpecializationId;
          this.progressionSystem.selectSpecialization(state, specId);
          this.render(state, player);
        });
      });
      return;
    }

    const filtered = UPGRADES_DEF.filter(u => u.category === this.activeUpgradeTab);
    listEl.innerHTML = filtered.map(u => {
      const cur = state.upgrades[u.id] || 0;
      const isMax = cur >= u.maxLevel;
      const reqLocked = u.requiresBuild && !state.builds[u.requiresBuild]?.built;
      const cost = isMax ? null : u.costs[cur];
      const affordable = !reqLocked && cost && this.inventorySystem.canAfford(state, player, cost);

      const costHtml = isMax
        ? '<span class="text-emerald-300 font-semibold text-xs">Nível Máximo ✓</span>'
        : reqLocked
        ? '<span class="text-amber-300 text-xs">Construa a Estação de Drones primeiro</span>'
        : cost
        ? Object.entries(cost).map(([resKey, amt]) => {
            const res = resKey as ResourceId;
            const def = RESOURCES[res];
            const have = this.inventorySystem.getTotalResource(state, player, res);
            const ok = have >= (amt || 0);
            return `<span class="px-2 py-0.5 rounded-lg text-[11px] font-medium ${
              ok
                ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/30'
                : 'bg-rose-950/60 text-rose-200 border border-rose-500/30'
            }">${def ? def.icon : ''} ${have}/${amt}</span>`;
          }).join(' ')
        : '';

      return `
        <div class="rounded-2xl p-4 bg-black/30 border border-stone-800 flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-sm font-bold text-amber-100">${u.name}</h3>
              <span class="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-semibold text-stone-200">Nv. ${cur}/${u.maxLevel}</span>
            </div>
            <p class="text-xs text-stone-300 mt-1 leading-relaxed">${u.desc}</p>
            ${!isMax ? `<div class="mt-2 text-[11px] font-semibold text-sky-300">${u.effectText(cur)}</div>` : ''}
          </div>
          <div class="pt-2 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap gap-1.5">${costHtml}</div>
            ${
              !isMax && !reqLocked
                ? `
              <button data-buy-upg="${u.id}" ${!affordable ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    affordable
                      ? 'bg-amber-400 hover:bg-amber-300 text-stone-950 cursor-pointer active:scale-95'
                      : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                  }">Melhorar</button>
            `
                : ''
            }
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-buy-upg]').forEach(btn => {
      btn.addEventListener('click', () => {
        const upgId = btn.getAttribute('data-buy-upg')!;
        this.upgradeSystem.buyUpgrade(state, player, upgId);
        this.render(state, player);
      });
    });
  }
}
