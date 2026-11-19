import { GameState, IslandDef, NodeType, ResourceNode } from '../domain/types.ts';
import { ISLANDS_DEF, INITIAL_NODE_SPAWNS, NODE_CONFIGS } from '../config/world.ts';

export interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  alpha: number;
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
    INITIAL_NODE_SPAWNS.forEach(spawn => {
      this.spawnNode(spawn.type, spawn.x, spawn.y, spawn.islandId);
    });
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
    for (let i = 0; i < 14; i++) {
      this.clouds.push({
        x: (Math.random() - 0.5) * 2600,
        y: (Math.random() - 0.5) * 2000,
        scale: 0.7 + Math.random() * 1.1,
        speed: 8 + Math.random() * 10,
        alpha: 0.14 + Math.random() * 0.14
      });
    }
  }

  isPointWalkable(state: GameState, x: number, y: number): boolean {
    for (const isl of this.islands) {
      if (!isl.unlocked(state)) continue;
      if (Math.abs(x - isl.x) <= isl.w / 2 - 16 && Math.abs(y - isl.y) <= isl.h / 2 - 16) {
        return true;
      }
    }
    if (state.builds.eastBridge?.built && x >= 325 && x <= 510 && y >= -42 && y <= 42) return true;
    if (state.builds.northBridge?.built && x >= -42 && x <= 42 && y >= -400 && y <= -245) return true;
    if (state.builds.westBridge?.built && x >= -520 && x <= -325 && y >= -42 && y <= 42) return true;
    return false;
  }

  update(dt: number, onRespawn?: (node: ResourceNode) => void): void {
    // 1. Atualiza nuvens
    this.clouds.forEach(c => {
      c.x += c.speed * dt;
      if (c.x > 1400) c.x = -1400;
    });

    // 2. Atualiza nós de recursos
    this.nodes.forEach(n => {
      if (n.hitAnim > 0) {
        n.hitAnim = Math.max(0, n.hitAnim - dt * 4.5);
      }
      if (n.depleted) {
        n.respawnTimer -= dt;
        if (n.respawnTimer <= 0) {
          n.depleted = false;
          n.hp = n.maxHp;
          if (onRespawn) onRespawn(n);
        }
      } else if (n.sweetSpotTimer > 0) {
        n.sweetSpotTimer = Math.max(0, n.sweetSpotTimer - dt);
      }
    });
  }
}
