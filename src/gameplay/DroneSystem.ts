import { DerivedStats, DroneEntity, DroneKind, GameState, IslandDef, ResourceNode } from '../domain/types.ts';
import { EventBus } from '../core/EventBus.ts';
import { RESOURCES } from '../config/resources.ts';
import { DRONE_KINDS, DRONE_MODELS } from '../config/drones.ts';
import { WAREHOUSE_POSITION } from '../config/buildings.ts';

export class DroneSystem {
  public drones: DroneEntity[] = [];

  constructor(private eventBus: EventBus) {}

  syncDrones(state: GameState): void {
    const desiredCounts = new Map(DRONE_KINDS.map(kind =>
      [kind, this.normalizeDroneCount(state.upgrades[DRONE_MODELS[kind].upgrade])] as const
    ));
    const currentCounts = new Map<DroneKind, number>();

    // Preserve drones already in operation, but discard any above the purchased levels.
    this.drones = this.drones.filter(drone => {
      const count = currentCounts.get(drone.kind) ?? 0;
      if (count >= (desiredCounts.get(drone.kind) ?? 0)) return false;
      currentCounts.set(drone.kind, count + 1);
      return true;
    });

    for (const [kind, count] of desiredCounts) {
      for (let i = currentCounts.get(kind) ?? 0; i < count; i++) {
        this.drones.push(this.createDrone(kind, i));
      }
    }
  }

  private normalizeDroneCount(level: number): number {
    return Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  }

  private createDrone(kind: DroneKind, index: number): DroneEntity {
    const model = DRONE_MODELS[kind];
    return {
      kind,
      x: model.spawnX + index * 25,
      y: model.spawnY,
      state: 'seek',
      targetNode: null,
      cargo: [],
      workTimer: 0,
      bobPhase: Math.random() * 6
    };
  }

  update(
    state: GameState,
    stats: DerivedStats,
    nodes: ResourceNode[],
    islands: IslandDef[],
    dt: number
  ): void {
    const { x: homeX, y: homeY } = WAREHOUSE_POSITION;

    this.drones.forEach(drone => {
      drone.bobPhase += dt * 4.5;
      const spd = 165 * stats.droneSpeedMult;

      if (state.droneFarmsPaused && drone.state !== 'return') {
        drone.targetNode = null;
        drone.state = drone.cargo.length > 0 ? 'return' : 'seek';
        if (drone.state === 'seek') return;
      }

      if (drone.state === 'seek') {
        let nearest: ResourceNode | null = null;
        let bestDistance = Infinity;
        for (const node of nodes) {
          if (!this.canHarvest(state, drone.kind, node, islands)) continue;
          const distance = (node.x - drone.x) ** 2 + (node.y - 16 - drone.y) ** 2;
          if (distance >= bestDistance) continue;
          nearest = node;
          bestDistance = distance;
        }
        drone.targetNode = nearest;
        if (nearest) drone.state = 'move';
      } else if (drone.state === 'move') {
        const n = drone.targetNode;
        if (!n || !this.canHarvest(state, drone.kind, n, islands)) {
          drone.targetNode = null;
          drone.state = 'seek';
          return;
        }

        const dx = n.x - drone.x;
        const dy = n.y - 16 - drone.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 14) {
          drone.state = 'harvest';
          drone.workTimer = 0.8 / stats.droneSpeedMult;
        } else {
          drone.x += (dx / dist) * spd * dt;
          drone.y += (dy / dist) * spd * dt;
        }
      } else if (drone.state === 'harvest') {
        const n = drone.targetNode;
        if (!n || !this.canHarvest(state, drone.kind, n, islands)) {
          drone.targetNode = null;
          drone.state = drone.cargo.length > 0 ? 'return' : 'seek';
          return;
        }

        drone.workTimer -= dt;
        if (drone.workTimer <= 0) {
          n.hp -= 1;
          n.hitAnim = 0.6;
          drone.cargo.push(n.resource);

          this.eventBus.emit('fx:burst', {
            x: n.x,
            y: n.y,
            color: RESOURCES[n.resource].color,
            count: 5
          });

          if (n.hp <= 0) {
            n.depleted = true;
            n.respawnTimer = n.respawnTime;
          }

          if (drone.cargo.length >= stats.droneCap || n.depleted) {
            drone.state = 'return';
          } else {
            drone.workTimer = 0.8 / stats.droneSpeedMult;
          }
        }
      } else if (drone.state === 'return') {
        const dx = homeX - drone.x;
        const dy = homeY - 12 - drone.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 18) {
          drone.cargo.forEach(r => {
            state.storage[r] = (state.storage[r] || 0) + 1;
            state.stats.totalHarvested++;
          });

          if (drone.cargo.length > 0) {
            this.eventBus.emit('fx:floatingText', {
              x: homeX,
              y: homeY - 34,
              text: `+${drone.cargo.length}`,
              color: '#a7f3d0'
            });
          }

          drone.cargo = [];
          drone.targetNode = null;
          drone.state = 'seek';
        } else {
          drone.x += (dx / dist) * spd * 1.15 * dt;
          drone.y += (dy / dist) * spd * 1.15 * dt;
        }
      }
    });
  }

  private canHarvest(state: GameState, kind: DroneKind, node: ResourceNode, islands: IslandDef[]): boolean {
    if (node.depleted || node.type !== DRONE_MODELS[kind].target) return false;
    return islands.find(island => island.id === node.islandId)?.unlocked(state) ?? true;
  }
}
