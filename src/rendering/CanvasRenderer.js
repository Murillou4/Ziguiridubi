import { Camera } from './Camera.js';
import { WorldRenderer } from './WorldRenderer.js';
import { ResourceRenderer } from './ResourceRenderer.js';
import { BuildingRenderer } from './BuildingRenderer.js';
import { PlayerRenderer } from './PlayerRenderer.js';
import { DroneRenderer } from './DroneRenderer.js';
import { EffectsRenderer } from './EffectsRenderer.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.camera = new Camera();
    this.worldRenderer = new WorldRenderer();
    this.resourceRenderer = new ResourceRenderer();
    this.buildingRenderer = new BuildingRenderer();
    this.playerRenderer = new PlayerRenderer();
    this.droneRenderer = new DroneRenderer();
    this.effectsRenderer = new EffectsRenderer();

    this.resize();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(state, player, stats, worldSystem, buildingSystem, drones, drops, worldTime) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    this.worldRenderer.renderSky(ctx, w, h);

    ctx.save();
    const camX = Math.round(w / 2 - this.camera.x + this.camera.shakeX);
    const camY = Math.round(h / 2 - this.camera.y + this.camera.shakeY);
    ctx.translate(camX, camY);

    this.worldRenderer.renderClouds(ctx, worldSystem.clouds);
    this.worldRenderer.renderIslands(ctx, worldSystem.islands, state);

    buildingSystem.blueprints.forEach(bp => {
      const st = state.builds[bp.id];
      if (!st?.built) {
        const pct = buildingSystem.getBlueprintProgressPct(bp, state);
        this.buildingRenderer.renderYellowBlueprintZone(ctx, bp, worldTime, pct);
      } else {
        this.buildingRenderer.renderBuiltStructure(ctx, bp, state, worldTime);
      }
    });

    this.buildingRenderer.renderMerchantStall(ctx, -95, -25, worldTime);
    this.buildingRenderer.renderWorkbenchAndWarehouse(ctx, 95, -25);

    this.resourceRenderer.renderNodes(
      ctx,
      worldSystem.nodes,
      worldSystem.islands,
      state,
      stats,
      worldTime
    );

    this.effectsRenderer.renderMoveTarget(ctx, player, worldTime);
    this.effectsRenderer.renderDrops(ctx, drops, worldTime);
    this.playerRenderer.renderPlayer(ctx, player, state, stats);
    this.effectsRenderer.renderProjectTrackerArrow(ctx, player, state);
    this.droneRenderer.renderDrones(ctx, drones, worldTime);

    this.effectsRenderer.renderParticles(ctx);
    this.effectsRenderer.renderFloatingTexts(ctx);

    ctx.restore();
  }
}
