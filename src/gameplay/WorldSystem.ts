import { GameState, IslandDef, NodeType, ResourceNode } from '../domain/types.ts';
import { BLUEPRINTS_DEF } from '../config/buildings.ts';
import { HUB_PLAZA, ISLAND_RESOURCE_COUNTS, ISLANDS_DEF, NODE_CONFIGS } from '../config/world.ts';

const ISLAND_WALKABLE_INSET = 16;
const BRIDGES = BLUEPRINTS_DEF.filter(bp => bp.isBridge);
const GROUP_DISTANCE = 108;
const MIN_SPAWN_GAP = 22;
const MIN_RESPAWN_DISTANCE = 72;
const PREFERRED_POSITION_ATTEMPTS = 96;
const MAX_POSITION_ATTEMPTS = 1024;
const MAX_LAYOUT_ATTEMPTS = 8;

const CLOUD_COUNT = 22;
const CLOUD_WRAP_X = 2200;
const CLOUD_MIN_Y = -1400;
const CLOUD_MAX_Y = 900;

interface Point {
  x: number;
  y: number;
}

function getWalkableBounds(island: IslandDef, inset = ISLAND_WALKABLE_INSET) {
  return {
    left: island.x - island.w / 2 + inset,
    right: island.x + island.w / 2 - inset,
    top: island.y - island.h / 2 + inset,
    bottom: island.y + island.h / 2 - inset
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const RESERVED_AREAS = BLUEPRINTS_DEF.map(bp => {
  // Extend along each bridge's axis into both islands, including before it is built.
  const padX = bp.isBridge && bp.w >= bp.h ? 66 : 20;
  const padY = bp.isBridge && bp.h > bp.w ? 66 : 20;
  return {
    left: bp.x - padX,
    right: bp.x + bp.w + padX,
    top: bp.y - padY,
    bottom: bp.y + bp.h + padY
  };
});

function overlapsReservedArea(point: Point, type: NodeType): boolean {
  // Canopies are taller than the tree's collection radius.
  const side = type === 'tree' ? 54 : 34;
  const above = type === 'tree' ? 87 : 34;
  const below = type === 'tree' ? 35 : 38;
  return RESERVED_AREAS.some(area =>
    point.x + side > area.left && point.x - side < area.right &&
    point.y + below > area.top && point.y - above < area.bottom
  );
}

export interface CloudPuff {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  alpha: number;
  puffs?: CloudPuff[];
  bobPhase?: number;
  bobAmp?: number;
  layer?: number;
  halfWidth?: number;
  halfHeight?: number;
}

export interface CloudGeometry {
  puffs: CloudPuff[];
  halfWidth: number;
  halfHeight: number;
}

export function createRandomCloudGeometry(rng: () => number = Math.random): CloudGeometry {
  const puffs: CloudPuff[] = [];
  const styleRoll = rng();

  if (styleRoll < 0.42) {
    // Cumulus clássico assimétrico com cúpula central e flancos arredondados
    puffs.push({
      x: (rng() - 0.5) * 10,
      y: -5 - rng() * 8,
      rx: 42 + rng() * 14,
      ry: 31 + rng() * 10
    });

    const crownSide = rng() < 0.5 ? -1 : 1;
    puffs.push({
      x: crownSide * (18 + rng() * 15),
      y: -12 - rng() * 10,
      rx: 30 + rng() * 11,
      ry: 23 + rng() * 8
    });

    puffs.push({
      x: -35 - rng() * 18,
      y: 3 + rng() * 7,
      rx: 28 + rng() * 12,
      ry: 20 + rng() * 8
    });

    puffs.push({
      x: 36 + rng() * 18,
      y: 2 + rng() * 8,
      rx: 30 + rng() * 13,
      ry: 21 + rng() * 8
    });

    if (rng() < 0.65) {
      puffs.push({
        x: -64 - rng() * 18,
        y: 7 + rng() * 6,
        rx: 18 + rng() * 9,
        ry: 13 + rng() * 6
      });
    }
    if (rng() < 0.65) {
      puffs.push({
        x: 65 + rng() * 18,
        y: 6 + rng() * 6,
        rx: 19 + rng() * 9,
        ry: 14 + rng() * 6
      });
    }
  } else if (styleRoll < 0.72) {
    // Nuvem alongada de brisa com ondulação suave
    const count = 5 + Math.floor(rng() * 4);
    const span = 125 + rng() * 75;
    const arch = 6 + rng() * 10;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const envelope = Math.sin(Math.PI * (0.15 + t * 0.7));
      const rx = (22 + envelope * 23) * (0.86 + rng() * 0.28);
      puffs.push({
        x: (t - 0.5) * span + (rng() - 0.5) * 14,
        y: -envelope * arch + (rng() - 0.5) * 9,
        rx,
        ry: rx * (0.68 + rng() * 0.16)
      });
    }
  } else if (styleRoll < 0.90) {
    // Tufo compacto fofo com volumes assimétricos
    const count = 3 + Math.floor(rng() * 3);
    puffs.push({
      x: 0,
      y: 2,
      rx: 34 + rng() * 12,
      ry: 25 + rng() * 9
    });
    for (let i = 1; i < count; i++) {
      const angle = ((i - 1) / Math.max(1, count - 1)) * Math.PI + (rng() - 0.5) * 0.55;
      const dist = 22 + rng() * 16;
      const rx = 23 + rng() * 12;
      puffs.push({
        x: Math.cos(angle) * dist * (rng() < 0.5 ? 1 : -1),
        y: -Math.abs(Math.sin(angle)) * (10 + rng() * 9) + (rng() - 0.4) * 8,
        rx,
        ry: rx * (0.72 + rng() * 0.16)
      });
    }
  } else {
    // Nuvem principal acompanhada de pequenos fiapos satélites
    puffs.push(
      { x: 0, y: -3 - rng() * 6, rx: 36 + rng() * 12, ry: 27 + rng() * 8 },
      { x: -28 - rng() * 12, y: 3 + rng() * 6, rx: 24 + rng() * 10, ry: 18 + rng() * 7 },
      { x: 29 + rng() * 12, y: 2 + rng() * 6, rx: 25 + rng() * 10, ry: 18 + rng() * 7 },
      { x: (rng() - 0.5) * 20, y: -13 - rng() * 7, rx: 22 + rng() * 8, ry: 17 + rng() * 6 }
    );

    const wispCount = 1 + Math.floor(rng() * 2);
    const wispDir = rng() < 0.5 ? -1 : 1;
    for (let w = 0; w < wispCount; w++) {
      const rx = 13 + rng() * 9;
      puffs.push({
        x: wispDir * (74 + w * 28 + rng() * 18),
        y: (rng() - 0.5) * 18,
        rx,
        ry: rx * (0.68 + rng() * 0.18)
      });
    }
  }

  let halfWidth = 40;
  let halfHeight = 30;
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    halfWidth = Math.max(halfWidth, Math.abs(p.x) + p.rx + 10);
    halfHeight = Math.max(halfHeight, Math.abs(p.y) + p.ry + 10);
  }

  return { puffs, halfWidth, halfHeight };
}

function randomizeCloudAttributes(cloud: Cloud, rng: () => number = Math.random): Cloud {
  const layer = cloud.layer ?? (rng() < 0.45 ? 0 : 1);
  const geom = createRandomCloudGeometry(rng);
  cloud.scale = layer === 0 ? 0.62 + rng() * 0.42 : 0.85 + rng() * 0.65;
  cloud.speed = layer === 0 ? 5 + rng() * 5 : 9 + rng() * 9;
  cloud.alpha = layer === 0 ? 0.18 + rng() * 0.1 : 0.26 + rng() * 0.14;
  cloud.puffs = geom.puffs;
  cloud.halfWidth = geom.halfWidth;
  cloud.halfHeight = geom.halfHeight;
  cloud.layer = layer;
  cloud.bobPhase = rng() * Math.PI * 2;
  cloud.bobAmp = 2 + rng() * 4;
  return cloud;
}

export class WorldSystem {
  public islands: IslandDef[] = ISLANDS_DEF;
  public nodes: ResourceNode[] = [];
  public clouds: Cloud[] = [];

  constructor() {
    this.initNodes();
    this.initClouds();
  }

  initNodes(): void {
    this.nodes = [];
    for (const island of this.islands) {
      const counts = ISLAND_RESOURCE_COUNTS[island.id] ?? {};
      const types = (Object.keys(NODE_CONFIGS) as NodeType[]).flatMap(type =>
        Array<NodeType>(counts[type] ?? 0).fill(type)
      );
      const firstNode = this.nodes.length;
      for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt++) {
        const pending = [...types];
        while (pending.length > 0) {
          const [type] = pending.splice(Math.floor(Math.random() * pending.length), 1);
          const point = this.pickNodePosition(island, type);
          if (!point) break;
          this.spawnNode(type, point.x, point.y, island.id);
        }
        const placed = this.nodes.slice(firstNode);
        if (placed.length === types.length) {
          const pairedCount = placed.filter(node =>
            placed.some(other => node !== other && distance(node, other) < GROUP_DISTANCE)
          ).length;
          if (placed.length < 3 || (pairedCount > 0 && pairedCount < placed.length)) break;
        }
        this.nodes.length = firstNode;
      }
      if (this.nodes.length - firstNode !== types.length) {
        throw new Error(`Sem espaço para os recursos da ilha ${island.id}.`);
      }
    }
  }

  private pickNodePosition(island: IslandDef, type: NodeType, previous?: ResourceNode): Point | undefined {
    const radius = NODE_CONFIGS[type].radius;
    // Keep room to stand and collect on the island side of the terrain edge.
    const bounds = getWalkableBounds(island, ISLAND_WALKABLE_INSET + radius + 12);
    const occupied = this.nodes.filter(node => node.islandId === island.id && !node.depleted);
    const pairable = new Set(occupied.filter(node =>
      !occupied.some(other => other !== node && distance(node, other) < GROUP_DISTANCE)
    ));
    const preferPair = occupied.length === 1 || (pairable.size > 1 &&
      (pairable.size === occupied.length || Math.random() < 0.33));
    let fallback: Point | undefined;

    for (let attempt = 0; attempt < MAX_POSITION_ATTEMPTS; attempt++) {
      if (fallback && attempt >= PREFERRED_POSITION_ATTEMPTS) return fallback;
      const point = {
        x: bounds.left + Math.random() * (bounds.right - bounds.left),
        y: bounds.top + Math.random() * (bounds.bottom - bounds.top)
      };
      if (previous && distance(point, previous) < MIN_RESPAWN_DISTANCE) continue;
      if (overlapsReservedArea(point, type)) continue;
      if (island.id === 'hub') {
        const dx = (point.x - HUB_PLAZA.x) / (HUB_PLAZA.radiusX + radius);
        const dy = (point.y - HUB_PLAZA.y) / (HUB_PLAZA.radiusY + radius);
        if (dx * dx + dy * dy < 1) continue;
      }

      const nearby = occupied.filter(node => distance(point, node) < GROUP_DISTANCE);
      // Only isolated resources can gain a neighbor, so close points never form chains.
      if (nearby.length > 1) continue;
      const [neighbor] = nearby;
      if (neighbor && (!pairable.has(neighbor) || distance(point, neighbor) < radius + neighbor.radius + MIN_SPAWN_GAP)) {
        continue;
      }
      if (Boolean(neighbor) === preferPair) return point;
      fallback ??= point;
    }
    return fallback;
  }

  spawnNode(type: NodeType, x: number, y: number, islandId: string): ResourceNode {
    const c = NODE_CONFIGS[type];
    const node: ResourceNode = {
      id: `${type}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      islandId,
      x,
      y,
      name: c.name,
      resource: c.resource,
      hp: c.maxHp,
      maxHp: c.maxHp,
      reqPower: c.reqPower,
      radius: c.radius,
      mat: c.mat,
      respawnTime: c.respawn,
      respawnTimer: 0,
      depleted: false,
      hitAnim: 0,
      sweetSpotTimer: 0,
      sweetSpotDuration: 1.35
    };
    this.nodes.push(node);
    return node;
  }

  initClouds(): void {
    this.clouds = [];
    const spanX = CLOUD_WRAP_X * 2;
    const spanY = CLOUD_MAX_Y - CLOUD_MIN_Y;
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const bandX = -CLOUD_WRAP_X + ((i + Math.random()) / CLOUD_COUNT) * spanX;
      const bandY = CLOUD_MIN_Y + Math.random() * spanY;
      this.clouds.push(
        randomizeCloudAttributes({
          x: bandX,
          y: bandY,
          scale: 1,
          speed: 10,
          alpha: 0.24
        })
      );
    }
    this.clouds.sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
  }

  updateClouds(dt: number): void {
    const spanY = CLOUD_MAX_Y - CLOUD_MIN_Y;
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.x += cloud.speed * dt;
      const exitExtent = (cloud.halfWidth ?? 120) * cloud.scale;
      if (cloud.x - exitExtent > CLOUD_WRAP_X) {
        randomizeCloudAttributes(cloud);
        const entryExtent = (cloud.halfWidth ?? 120) * cloud.scale;
        cloud.x = -CLOUD_WRAP_X - entryExtent;
        cloud.y = CLOUD_MIN_Y + Math.random() * spanY;
      }
    }
  }

  isPointWalkable(state: GameState, x: number, y: number): boolean {
    for (const isl of this.islands) {
      if (!isl.unlocked(state)) continue;
      const { left, right, top, bottom } = getWalkableBounds(isl);
      if (x >= left && x <= right && y >= top && y <= bottom) {
        return true;
      }
    }
    return BRIDGES.some(bp => {
      if (!state.builds[bp.id]?.built) return false;
      const horizontal = bp.w >= bp.h;
      // A passagem precisa alcançar a área caminhável nas duas margens.
      const padX = horizontal ? ISLAND_WALKABLE_INSET : 4;
      const padY = horizontal ? 4 : ISLAND_WALKABLE_INSET;
      return x >= bp.x - padX && x <= bp.x + bp.w + padX &&
             y >= bp.y - padY && y <= bp.y + bp.h + padY;
    });
  }

  update(dt: number, onRespawn?: (node: ResourceNode) => void): void {
    // Atualiza nós de recursos
    this.nodes.forEach(n => {
      if (n.hitAnim > 0) {
        n.hitAnim = Math.max(0, n.hitAnim - dt * 4.5);
      }
      if (n.depleted) {
        n.respawnTimer -= dt;
        if (n.respawnTimer <= 0) {
          const island = this.islands.find(isl => isl.id === n.islandId);
          const point = island && this.pickNodePosition(island, n.type, n);
          if (!point) {
            n.respawnTimer = 0.25;
            return;
          }
          n.x = point.x;
          n.y = point.y;
          n.depleted = false;
          n.hp = n.maxHp;
          n.respawnTimer = 0;
          n.hitAnim = 0;
          n.sweetSpotTimer = 0;
          onRespawn?.(n);
        }
      } else if (n.sweetSpotTimer > 0) {
        n.sweetSpotTimer = Math.max(0, n.sweetSpotTimer - dt);
      }
    });
  }
}
