import { DerivedStats, GameState, PlayerState, ResourceId } from '../domain/types.ts';
import { RESOURCES } from '../config/resources.ts';
import { PHASES_INFO } from '../config/phases.ts';
import { AIRSHIP_ROUTES } from '../config/airshipRoutes.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';
import { getResourceIconUrl } from './resource-icon.ts';
import type { TutorialAction, TutorialCue } from '../domain/Tutorial.ts';
import type { InputMode } from '../input/InputManager.ts';
import { drawTutorialIcon, TUTORIAL_ICONS, type TutorialIcon } from '../rendering/tutorial-icons.ts';

const TUTORIAL_TITLES: Record<TutorialAction, string> = {
  walk: 'Dê os primeiros passos',
  chop: 'Corte uma árvore',
  mine: 'Quebre uma pedra',
  pickup: 'Recolha os recursos',
  unload: 'Esvazie a mochila no armazém',
  approach: 'Vá até a serraria',
  inspect: 'Abra a obra da serraria',
  deposit: 'Deposite madeira'
};

function tutorialControl(action: TutorialAction, mode: InputMode): { text: string; icon?: TutorialIcon; key?: string } {
  const swing = action === 'chop' || action === 'mine';
  const build = action === 'inspect' || action === 'deposit';
  if (mode === 'mouse') {
    const text = action === 'chop' ? 'Clique na árvore'
      : action === 'mine' ? 'Clique na pedra'
      : action === 'deposit' ? 'Clique em Depositar'
      : action === 'inspect' || action === 'approach' ? 'Clique na serraria'
      : action === 'walk' ? 'Clique no chão'
      : 'Clique perto da marca';
    return { icon: 'mouse', text };
  }
  if (mode === 'touch') {
    if (swing) return { icon: 'mallet', text: 'Chegue perto e toque no martelo' };
    if (build) return { key: 'E', text: 'Toque no botão E' };
    return { icon: 'joystick', text: action === 'pickup' ? 'Use o joystick para chegar perto' : 'Arraste o joystick' };
  }
  if (swing) return { key: 'Espaço', text: 'Chegue perto e vire para o alvo' };
  if (build) return { key: 'E', text: action === 'inspect' ? 'Inspecione a obra' : 'Entregue os materiais' };
  return { key: 'WASD', text: action === 'pickup' ? 'Chegue perto para recolher' : 'ou use as setas' };
}

function paintTutorialIcon(canvas: HTMLCanvasElement, icon: TutorialIcon): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(canvas.width / 25, canvas.height / 25);
  drawTutorialIcon(ctx, icon);
  ctx.restore();
}

export class HUDView {
  private resourceState?: GameState;
  private tutorialAction?: TutorialAction;
  private tutorialKey = '';
  private tutorialAnimation?: Animation;

  constructor(private inventorySystem: InventorySystem) {}

  update(state: GameState, player: PlayerState, stats: DerivedStats): void {
    this.updateResourceBar(state, player);
    this.updateBackpackAndDash(player, stats);
    this.updateAirshipFlightBanner(state);
    this.updateObjectiveCard(state);
  }

  updateTutorial(cue: TutorialCue | null, mode: InputMode): void {
    const action = cue?.action;
    const key = action ? `${action}:${mode}` : '';
    if (this.tutorialKey === key) return;
    const hint = document.getElementById('tutorialHint');
    if (!hint) return;

    this.tutorialKey = key;
    const changedAction = this.tutorialAction !== action;
    this.tutorialAction = action;
    hint.hidden = !action;
    const hud = document.getElementById('hudLayer');
    hud?.toggleAttribute('data-tutorial-active', Boolean(action));
    hud?.removeAttribute('data-tutorial-control');
    if (!action) return;

    const control = tutorialControl(action, mode);
    hint.dataset.action = action;
    hint.dataset.input = mode;
    const title = document.getElementById('tutorialTitle')!;
    const instruction = document.getElementById('tutorialInstruction')!;
    const keycap = document.getElementById('tutorialKey')!;
    const controlIcon = document.getElementById('tutorialControlIcon') as HTMLCanvasElement;
    title.textContent = TUTORIAL_TITLES[action];
    instruction.textContent = control.text;
    keycap.hidden = !control.key;
    keycap.textContent = control.key ?? '';
    controlIcon.hidden = !control.icon;
    if (control.icon) paintTutorialIcon(controlIcon, control.icon);
    if (mode === 'touch' && hud) hud.dataset.tutorialControl = control.icon ?? 'interact';

    if (!changedAction) return;
    paintTutorialIcon(document.getElementById('tutorialActionIcon') as HTMLCanvasElement, TUTORIAL_ICONS[action]);
    this.tutorialAnimation?.cancel();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.tutorialAnimation = hint.animate([
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 210, easing: 'ease-out' });
    }
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

    const animateGains = this.resourceState === state;
    if (!animateGains) {
      resBar.replaceChildren();
      this.resourceState = state;
    }
    for (const child of Array.from(resBar.children) as HTMLElement[]) {
      if (!keys.includes(child.dataset.resource as ResourceId)) child.remove();
    }

    for (const [index, k] of keys.entries()) {
      const def = RESOURCES[k];
      const val = this.inventorySystem.getTotalResource(state, player, k);
      let chip = resBar.querySelector<HTMLElement>(`[data-resource="${k}"]`);
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'hud-resource';
        chip.dataset.resource = k;
        chip.title = def.name;
        const iconUrl = getResourceIconUrl(k);
        chip.innerHTML = `
          <span class="hud-resource-main">
            <img src="${iconUrl}" alt="" width="24" height="24">
            <span class="hud-resource-value"></span>
          </span>
          <span class="hud-resource-gain" aria-hidden="true">
            <img src="${iconUrl}" alt="" width="14" height="14">
            <span></span>
          </span>
        `;
      }
      const next = resBar.children.item(index);
      if (next !== chip) resBar.insertBefore(chip, next);

      const value = chip.querySelector<HTMLElement>('.hud-resource-value')!;
      const gain = val - Number(value.textContent);
      if (value.textContent === String(val)) continue;

      value.textContent = String(val);
      chip.setAttribute('aria-label', `${def.name}: ${val}`);
      if (animateGains && gain > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const main = chip.querySelector<HTMLElement>('.hud-resource-main')!;
        for (const motion of main.getAnimations()) motion.cancel();
        main.animate([
          { transform: 'scale(1)', color: '#fff2cb' },
          { transform: 'scale(1.28)', color: '#ffd78a', offset: .32 },
          { transform: 'scale(1)' }
        ], { duration: 330, easing: 'ease-out' });

        const badge = chip.querySelector<HTMLElement>('.hud-resource-gain')!;
        const badgeValue = badge.querySelector('span')!;
        const previousGain = badge.getAnimations()[0];
        const displayedGain = gain + (previousGain ? Number(badgeValue.textContent) : 0);
        previousGain?.cancel();
        badgeValue.textContent = `+${displayedGain}`;
        badge.animate([
          { opacity: 0, transform: 'translateY(-3px) scale(.86)' },
          { opacity: 1, transform: 'translateY(0) scale(1)', offset: .2 },
          { opacity: 1, transform: 'translateY(2px)', offset: .68 },
          { opacity: 0, transform: 'translateY(8px)' }
        ], { duration: 660, easing: 'ease-out' });
      }
    }
  }

  animateWarehouseReceipt(resource: ResourceId): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const icon = document.querySelector<HTMLImageElement>(`#resourceBar [data-resource="${resource}"] .hud-resource-main img`);
    if (!icon) return;

    for (const motion of icon.getAnimations()) motion.cancel();
    icon.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.15)', filter: 'brightness(1.45)', offset: .32 },
      { transform: 'scale(1)' }
    ], { duration: 280, easing: 'ease-out' });
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
