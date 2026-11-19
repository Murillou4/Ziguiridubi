import { DerivedStats, DroneEntity, DropItem, GameState, PlayerState, ResourceNode } from '../domain/types.ts';
import { Camera } from './Camera.ts';
import { WorldRenderer } from './WorldRenderer.ts';
import { ResourceRenderer } from './ResourceRenderer.ts';
import { BuildingRenderer } from './BuildingRenderer.ts';
import { PlayerRenderer } from './PlayerRenderer.ts';
import { DroneRenderer } from './DroneRenderer.ts';
import { EffectsRenderer } from './EffectsRenderer.ts';
import { WorldSystem } from '../gameplay/WorldSystem.ts';
import { BuildingSystem } from '../gameplay/BuildingSystem.ts';

export class CanvasRenderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public width: number = 0;
  public height: number = 0;
  public dpr: number = 1;

  public camera: Camera;
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
    worldTime: number
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Céu / Mar de Nuvens
    this.worldRenderer.renderSky(ctx, w, h);

    ctx.save();
    const camX = Math.round(w / 2 - this.camera.x + this.camera.shakeX);
    const camY = Math.round(h / 2 - this.camera.y + this.camera.shakeY);
    ctx.translate(camX, camY);

    // 2. Nuvens abaixo das ilhas
    this.worldRenderer.renderClouds(ctx, worldSystem.clouds);

    // 3. Ilhas Flutuantes
    this.worldRenderer.renderIslands(ctx, worldSystem.islands, state);

    // 4. Zonas de Projeto em Amarelo (Não Construídas) & Estruturas/Pontes Construídas
    buildingSystem.blueprints.forEach(bp => {
      const st = state.builds[bp.id];
      if (!st?.built) {
        const pct = buildingSystem.getBlueprintProgressPct(bp, state);
        this.buildingRenderer.renderYellowBlueprintZone(ctx, bp, worldTime, pct);
      } else {
        this.buildingRenderer.renderBuiltStructure(ctx, bp, state, worldTime);
      }
    });

    // 5. Praça Central: BANCA DO MERCADOR (-95, -25) & BANCADA / ARMAZÉM (95, -25)
    this.buildingRenderer.renderMerchantStall(ctx, -95, -25, worldTime);
    this.buildingRenderer.renderWorkbenchAndWarehouse(ctx, 95, -25);

    // 6. Nós de Recursos + Anel Rítmico Sweet Spot
    this.resourceRenderer.renderNodes(
      ctx,
      worldSystem.nodes,
      worldSystem.islands,
      state,
      stats,
      worldTime
    );

    // 7. Indicador de destino ao clicar no chão
    this.effectsRenderer.renderMoveTarget(ctx, player, worldTime);

    // 8. Orbes de Recursos no Chão
    this.effectsRenderer.renderDrops(ctx, drops, worldTime);

    // 9. Personagem + Mochila Física Empilhada
    this.playerRenderer.renderPlayer(ctx, player, state, stats);

    // 10. Seta Guia para Projeto Rastreado
    this.effectsRenderer.renderProjectTrackerArrow(ctx, player, state);

    // 11. Drones Autônomos
    this.droneRenderer.renderDrones(ctx, drones, worldTime);

    // 12. Partículas & Textos Flutuantes
    this.effectsRenderer.renderParticles(ctx);
    this.effectsRenderer.renderFloatingTexts(ctx);

    ctx.restore();
  }
}
