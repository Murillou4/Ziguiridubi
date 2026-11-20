import { DerivedStats, DroneEntity, DropItem, GameState, PlayerState, ResourceNode } from '../domain/types.ts';
import { Camera } from './Camera.ts';
import type { RealTimeSnapshot } from '../core/GameClock.ts';
import { updateIslandFauna } from './world-terrain.ts';
import { WorldRenderer } from './WorldRenderer.ts';
import { ViewRect } from './world-terrain.ts';
import { ResourceRenderer } from './ResourceRenderer.ts';
import { BuildingRenderer } from './BuildingRenderer.ts';
import { PlayerRenderer } from './PlayerRenderer.ts';
import { DroneRenderer } from './DroneRenderer.ts';
import { EffectsRenderer } from './EffectsRenderer.ts';
import { WorldSystem } from '../gameplay/WorldSystem.ts';
import { BuildingSystem } from '../gameplay/BuildingSystem.ts';
import { getBlueprintDistance, getNearbyStation, WAREHOUSE_POSITION } from '../config/buildings.ts';
import type { TutorialCue } from '../domain/Tutorial.ts';
import { drawWorldTutorial } from './world-tutorial.ts';

const INTERACTION_PROMPT_RANGE = 58;
const INTERACTION_PROMPT_DELAY = 0.22;

export class CanvasRenderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public width: number = 0;
  public height: number = 0;
  public dpr: number = 1;

  public camera: Camera;
  private lastFaunaTime?: number;
  private interactionPromptLabel: string | null = null;
  private interactionPromptSince = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly view: ViewRect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  public worldRenderer: WorldRenderer;
  public resourceRenderer: ResourceRenderer;
  public buildingRenderer: BuildingRenderer;
  public playerRenderer: PlayerRenderer;
  public droneRenderer: DroneRenderer;
  public effectsRenderer: EffectsRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.camera = new Camera();
    this.worldRenderer = new WorldRenderer();
    this.resourceRenderer = new ResourceRenderer();
    this.buildingRenderer = new BuildingRenderer();
    this.playerRenderer = new PlayerRenderer();
    this.droneRenderer = new DroneRenderer();
    this.effectsRenderer = new EffectsRenderer();

    this.resize();
  }

  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(
    state: GameState,
    player: PlayerState,
    stats: DerivedStats,
    worldSystem: WorldSystem,
    buildingSystem: BuildingSystem,
    drones: DroneEntity[],
    drops: DropItem[],
    worldTime: number,
    activeModal: string | null = null,
    showGuides = true,
    realTime?: RealTimeSnapshot,
    isInspecting = false,
    tutorial: TutorialCue | null = null
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const weather = realTime?.weather;

    // 1. Céu / Mar de Nuvens
    this.worldRenderer.renderSky(ctx, w, h, realTime?.sky);
    if (weather) this.worldRenderer.renderLightning(ctx, w, h, weather);

    ctx.save();
    const camX = w / 2 - this.camera.x * this.camera.zoom;
    const camY = h / 2 - this.camera.y * this.camera.zoom;
    ctx.translate(camX, camY);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Retângulo visível em coordenadas de mundo (para cortar decoração fora da tela)
    const halfW = w / 2 / this.camera.zoom;
    const halfH = h / 2 / this.camera.zoom;
    const view = this.view;
    view.x0 = this.camera.x - halfW;
    view.x1 = this.camera.x + halfW;
    view.y0 = this.camera.y - halfH;
    view.y1 = this.camera.y + halfH;

    // 2. Nuvens abaixo das ilhas
    this.worldRenderer.renderClouds(ctx, worldSystem.clouds, worldTime, view, realTime?.sky, realTime?.lighting);

    // 3. Ilhas Flutuantes + terreno vivo (grama, flores, cogumelos, raízes)
    if (realTime) {
      const dt = Math.max(0, Math.min(0.05, worldTime - (this.lastFaunaTime ?? worldTime)));
      const immediate = this.lastFaunaTime === undefined || realTime.jumped;
      for (const island of worldSystem.islands) {
        updateIslandFauna(
          island, island.unlocked(state), dt, realTime.hourDecimal,
          showGuides ? player : undefined, immediate, weather, worldSystem.nodes
        );
      }
      this.lastFaunaTime = worldTime;
    }
    this.worldRenderer.renderIslands(
      ctx, worldSystem.islands, state, worldTime, view, player, realTime?.lighting, worldSystem.nodes
    );
    if (weather) this.worldRenderer.renderRainSplashes(ctx, worldSystem.islands, view, worldTime, weather.intensity);

    // 4. Obras e construções no mapa
    const nearbyBlueprint = showGuides ? buildingSystem.getNearbyBlueprint(player.x, player.y, state) : null;
    const guideOptions = {
      worldTime,
      nearbyBlueprintId: nearbyBlueprint?.id,
      trackedBlueprintId: state.trackedBuildId
    };
    for (const bp of buildingSystem.blueprints) {
      const progress = buildingSystem.getBlueprintProgress(bp, state);
      this.buildingRenderer.renderProject(ctx, bp, state, progress, guideOptions, showGuides);
    }

    // 5. Praça Central: BANCA DO MERCADOR (-95, -25) & BANCADA / ARMAZÉM (95, -25)
    this.buildingRenderer.renderMerchantStall(ctx, -95, -25, {
      time: worldTime,
      near: Math.max(0, 1 - Math.hypot(player.x + 95, player.y + 25) / 95),
      active: activeModal === 'modalMerchant' ? 1 : 0
    });
    this.buildingRenderer.renderWorkbenchAndWarehouse(ctx, WAREHOUSE_POSITION.x, WAREHOUSE_POSITION.y, {
      time: worldTime,
      near: Math.max(0, 1 - Math.hypot(player.x - WAREHOUSE_POSITION.x, player.y - WAREHOUSE_POSITION.y) / 95),
      active: activeModal === 'modalWorkshop' ? 1 : this.effectsRenderer.warehouseOpening
    });

    // 6. Nós de Recursos + Anel Rítmico Sweet Spot
    this.resourceRenderer.renderNodes(
      ctx,
      worldSystem.nodes,
      worldSystem.islands,
      state,
      stats,
      worldTime,
      player
    );

    // 7. Indicador de destino ao clicar no chão
    this.effectsRenderer.renderMoveTarget(ctx, player, worldTime);

    // 8. Orbes de Recursos no Chão
    this.effectsRenderer.renderDrops(ctx, drops, worldTime, view);

    // 8b. Marcação no chão do recurso selecionado
    this.effectsRenderer.renderAttackTarget(ctx, player, stats);

    // 9. Personagem + Mochila Física Empilhada
    this.playerRenderer.renderPlayer(ctx, player, state, stats, worldTime);

    // 10. Seta Guia para Projeto Rastreado
    if (showGuides && !tutorial) this.effectsRenderer.renderProjectTrackerArrow(ctx, player, state);

    // 11. Drones Autônomos
    this.droneRenderer.renderDrones(ctx, drones, worldTime);

    // 11b. Borboletas, vaga-lumes e pétalas à deriva
    this.worldRenderer.renderAmbient(ctx, worldSystem.islands, state, worldTime, view, realTime?.lighting);

    // 12. Partículas & Textos Flutuantes
    this.effectsRenderer.renderWarehouseTransfers(ctx);
    this.effectsRenderer.renderParticles(ctx);
    this.effectsRenderer.renderFloatingTexts(ctx);

    ctx.restore();
    if (weather) this.worldRenderer.renderRain(ctx, w, h, worldTime, weather);
    if (tutorial && tutorial.action !== 'deposit') {
      drawWorldTutorial(ctx, tutorial, this.camera, player, w, h, this.reducedMotion.matches ? 0 : worldTime);
    }

    // A dica espera o jogador desacelerar perto do alvo acionado por [E].
    let label: string | null = null;
    if (showGuides && !activeModal && !isInspecting && !tutorial && Math.hypot(player.vx, player.vy) <= stats.moveSpeed * 0.2) {
      if (nearbyBlueprint) {
        if (getBlueprintDistance(nearbyBlueprint, player.x, player.y) < INTERACTION_PROMPT_RANGE) {
          label = nearbyBlueprint.name.split(':')[0];
        }
      } else {
        const station = getNearbyStation(player.x, player.y, state);
        if (station && Math.hypot(player.x - station.x, player.y - station.y) < INTERACTION_PROMPT_RANGE) {
          label = station.label;
        }
      }
    }

    if (label !== this.interactionPromptLabel || worldTime < this.interactionPromptSince) {
      this.interactionPromptLabel = label;
      this.interactionPromptSince = worldTime;
    }
    if (!label || worldTime - this.interactionPromptSince < INTERACTION_PROMPT_DELAY) return;

    const x = camX + player.x * this.camera.zoom;
    const footY = camY + player.y * this.camera.zoom;
    if (x >= 0 && x <= w && footY >= 0 && footY <= h) {
      this.buildingRenderer.renderInteractionLabel(ctx, x, footY - 38 * this.camera.zoom - 10, label, w);
    }
  }
}
