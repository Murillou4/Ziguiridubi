import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSimulationController } from '../../src/app/GameSimulationController.ts';
import { GameRuntimeContext } from '../../src/app/GameContext.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { GameClock } from '../../src/core/GameClock.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { BLUEPRINTS_DEF } from '../../src/config/buildings.ts';
import { getDerivedStats } from '../../src/domain/Stats.ts';
import { GatheringSystem } from '../../src/gameplay/GatheringSystem.ts';
import { createRandomCloudGeometry, WorldSystem } from '../../src/gameplay/WorldSystem.ts';
import { WorldRenderer } from '../../src/rendering/WorldRenderer.ts';

describe('expanded island layout', () => {
  it('leaves construction access and both bridge entrances clear of resources', () => {
    const world = new WorldSystem();
    for (const node of world.nodes) {
      // Include sprite height, sway and room for players to approach.
      const tree = node.type === 'tree';
      const left = node.x - (tree ? 54 : 34);
      const right = node.x + (tree ? 54 : 34);
      const top = node.y - (tree ? 87 : 34);
      const bottom = node.y + (tree ? 35 : 38);
      const overlapping = BLUEPRINTS_DEF.find(bp => {
        const padX = bp.isBridge && bp.w >= bp.h ? 60 : 16;
        const padY = bp.isBridge && bp.h > bp.w ? 60 : 16;
        return left < bp.x + bp.w + padX && right > bp.x - padX &&
          top < bp.y + bp.h + padY && bottom > bp.y - padY;
      });
      expect(overlapping?.id, `${node.type} em (${node.x}, ${node.y})`).toBeUndefined();
    }
  });

  it('keeps resource spawns walkable and bridges connected only when built', () => {
    const world = new WorldSystem();
    const state = createDefaultState();
    const bridges = [
      { id: 'eastBridge', start: 480, end: 670, horizontal: true },
      { id: 'westBridge', start: -680, end: -480, horizontal: true },
      { id: 'northBridge', start: -400, end: -300, horizontal: false }
    ] as const;
    for (const bridge of bridges) {
      const isWalkable = (position: number) => bridge.horizontal
        ? world.isPointWalkable(state, position, 0)
        : world.isPointWalkable(state, 0, position);
      expect(isWalkable((bridge.start + bridge.end) / 2)).toBe(false);
      state.builds[bridge.id].built = true;
      for (let position = bridge.start; position <= bridge.end; position++) {
        expect(isWalkable(position), `${bridge.id} em ${position}`).toBe(true);
      }
    }
    for (const node of world.nodes) {
      const island = world.islands.find(island => island.id === node.islandId)!;
      expect(Math.abs(node.x - island.x) + node.radius).toBeLessThan(island.w / 2 - 16);
      expect(Math.abs(node.y - island.y) + node.radius).toBeLessThan(island.h / 2 - 16);
      expect(world.isPointWalkable(state, node.x, node.y)).toBe(true);
    }
  });
});

describe('resource placement', () => {
  beforeEach(() => {
    let seed = 1;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('rerolls all positions on reset and preserves each island’s resource mix', () => {
    const world = new WorldSystem();
    const originalPositions = new Set(world.nodes.map(node => `${node.x},${node.y}`));
    world.initNodes();

    const counts = Object.fromEntries(world.islands.map(island => {
      const nodes = world.nodes.filter(node => node.islandId === island.id);
      const byType: Record<string, number> = {};
      const neighborCounts = [];
      for (const node of nodes) {
        expect(originalPositions.has(`${node.x},${node.y}`)).toBe(false);
        byType[node.type] = (byType[node.type] ?? 0) + 1;

        const nearby = nodes.filter(other =>
          other !== node && Math.hypot(other.x - node.x, other.y - node.y) < 108
        );
        neighborCounts.push(nearby.length);
        expect(nearby.length).toBeLessThanOrEqual(1);
        for (const neighbor of nearby) {
          expect(Math.hypot(neighbor.x - node.x, neighbor.y - node.y))
            .toBeGreaterThanOrEqual(node.radius + neighbor.radius + 22);
        }
      }
      expect(neighborCounts).toContain(0);
      expect(neighborCounts).toContain(1);
      return [island.id, byType];
    }));
    expect(counts).toEqual({
      hub: { tree: 17, rock: 9 },
      east_hill: { iron: 11, rock: 5, tree: 2 },
      north_dock: { tree: 6, rock: 4 },
      west_crystal: { ether: 11, rock: 1 }
    });
  });

  it('waits for each depleted resource to respawn at a new position on its island', () => {
    const world = new WorldSystem();
    const state = createDefaultState();
    const gathering = new GatheringSystem(new EventBus());
    state.builds.eastBridge.built = true;
    state.builds.westBridge.built = true;
    state.builds.northBridge.built = true;

    for (const node of world.nodes) {
      const { id, type, islandId, x, y, maxHp, respawnTime } = node;
      const onRespawn = vi.fn();
      gathering.damageNode(node, maxHp, false, state, getDerivedStats(state));
      world.update(respawnTime - 0.5, onRespawn);
      expect(node).toMatchObject({ x, y, hp: 0, depleted: true });
      expect(onRespawn).not.toHaveBeenCalled();

      world.update(0.5, onRespawn);
      expect(onRespawn).toHaveBeenCalledExactlyOnceWith(node);
      expect(node).toMatchObject({ id, type, islandId, hp: maxHp, depleted: false });
      expect(Math.hypot(node.x - x, node.y - y)).toBeGreaterThanOrEqual(72);
      const island = world.islands.find(island => island.id === islandId)!;
      expect(Math.abs(node.x - island.x) + node.radius).toBeLessThan(island.w / 2 - 16);
      expect(Math.abs(node.y - island.y) + node.radius).toBeLessThan(island.h / 2 - 16);
      expect(world.isPointWalkable(state, node.x, node.y)).toBe(true);
    }
  });
});

describe('WorldSystem cloud updates', () => {
  it('keeps cloud movement separate from resource-node updates', () => {
    const world = new WorldSystem();
    const cloud = { x: 100, y: 0, scale: 1, speed: 20, alpha: 0.2 };
    world.clouds = [cloud];

    world.update(0.5);
    expect(cloud.x).toBe(100);

    world.updateClouds(0.5);
    expect(cloud.x).toBe(110);
  });

  it('updates clouds exactly once per title-screen frame', () => {
    const world = new WorldSystem();
    const cloud = { x: 100, y: 0, scale: 1, speed: 20, alpha: 0.2 };
    world.clouds = [cloud];
    const clock = new GameClock();
    const setIdlePan = vi.fn();

    const context = {
      clock,
      getState: () => createDefaultState(),
      getPlayer: () => createDefaultPlayer(),
      getIsPlaying: () => false,
      worldSystem: world,
      renderer: { camera: { setIdlePan } }
    } as unknown as GameRuntimeContext;

    new GameSimulationController(context).update(0.5);

    expect(cloud.x).toBe(110);
    expect(setIdlePan).toHaveBeenCalledOnce();
  });

  it('generates randomized cloud silhouettes and rerolls shape when wrapping', () => {
    const world = new WorldSystem();
    expect(world.clouds.length).toBeGreaterThanOrEqual(14);

    const signatures = new Set(
      world.clouds.map(cloud =>
        (cloud.puffs ?? [])
          .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.rx.toFixed(1)},${p.ry.toFixed(1)}`)
          .join('|')
      )
    );
    expect(signatures.size).toBeGreaterThan(1);

    const cloud = world.clouds[0];
    const initialLayer = cloud.layer;
    const initialSignature = (cloud.puffs ?? [])
      .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.rx.toFixed(1)},${p.ry.toFixed(1)}`)
      .join('|');

    cloud.x = 5000;
    world.updateClouds(0.1);

    expect(cloud.x).toBeLessThan(-2000);
    expect(cloud.layer).toBe(initialLayer);
    const wrappedSignature = (cloud.puffs ?? [])
      .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.rx.toFixed(1)},${p.ry.toFixed(1)}`)
      .join('|');
    expect(wrappedSignature).not.toBe(initialSignature);
  });

  it('draws each cloud puff as an independent closed subpath without connecting lines', () => {
    const geom = createRandomCloudGeometry(() => 0.2);
    expect(geom.puffs.length).toBeGreaterThanOrEqual(3);

    const ops: string[] = [];
    const ctx = {
      globalAlpha: 1,
      fillStyle: '',
      save: vi.fn(() => ops.push('save')),
      restore: vi.fn(() => ops.push('restore')),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(() => ops.push('beginPath')),
      moveTo: vi.fn(() => ops.push('moveTo')),
      ellipse: vi.fn(() => ops.push('ellipse')),
      closePath: vi.fn(() => ops.push('closePath')),
      fill: vi.fn(() => ops.push('fill'))
    } as unknown as CanvasRenderingContext2D;

    const renderer = new WorldRenderer();
    renderer.renderClouds(ctx, [{ x: 0, y: 0, scale: 1, speed: 10, alpha: 0.3, puffs: geom.puffs }]);

    for (let i = 0; i < ops.length; i++) {
      if (ops[i] === 'ellipse') {
        expect(ops[i - 1]).toBe('moveTo');
        expect(ops[i + 1]).toBe('closePath');
      }
    }
    expect(ctx.fill).toHaveBeenCalledTimes(4);
  });
});
