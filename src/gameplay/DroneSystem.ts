import { DerivedStats, DroneEntity, DroneKind, GameState, IslandDef, ResourceNode } from '../domain/types.ts';
import { EventBus } from '../core/EventBus.ts';
import { RESOURCES } from '../config/resources.ts';

export class DroneSystem {
  public drones: DroneEntity[] = [];

  constructor(private eventBus: EventBus) {}

  syncDrones(state: GameState): void {
    const desiredCounts: Record<DroneKind, number> = {
      lumber: this.normalizeDroneCount(state.upgrades.lumberDrone),
      miner: this.normalizeDroneCount(state.upgrades.minerDrone)
    };
    const currentCounts: Record<DroneKind, number> = {
      lumber: 0,
      miner: 0
    };

    // Preserve drones already in operation, but discard any above the purchased levels.
    this.drones = this.drones.filter(drone => {
      if (currentCounts[drone.kind] >= desiredCounts[drone.kind]) {
        return false;
      }

      currentCounts[drone.kind]++;
      return true;
    });

    for (let i = currentCounts.lumber; i < desiredCounts.lumber; i++) {
      this.drones.push(this.createDrone('lumber', i));
    }

    for (let i = currentCounts.miner; i < desiredCounts.miner; i++) {
      this.drones.push(this.createDrone('miner', i));
    }
  }

  private normalizeDroneCount(level: number): number {
    return Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  }

  private createDrone(kind: DroneKind, index: number): DroneEntity {
    return {
      kind,
      x: (kind === 'lumber' ? 220 : 250) + index * 25,
      y: -110,
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
    const homeX = 95;
    const homeY = -25;

    this.drones.forEach(drone => {
      drone.bobPhase += dt * 4.5;
      const spd = 165 * stats.droneSpeedMult;

      if (drone.state === 'seek') {
        const types = drone.kind === 'lumber' ? ['tree'] : ['rock', 'iron', 'ether'];
        const cands = nodes.filter(n => {
          if (n.depleted || !types.includes(n.type)) return false;
          const isl = islands.find(i => i.id === n.islandId);
          return !isl || isl.unlocked(state);
        });

        if (cands.length > 0) {
          cands.sort(
            (a, b) =>
              Math.hypot(a.x - drone.x, a.y - drone.y) - Math.hypot(b.x - drone.x, b.y - drone.y)
          );
          drone.targetNode = cands[0];
          drone.state = 'move';
        }
      } else if (drone.state === 'move') {
        const n = drone.targetNode;
        if (!n || n.depleted) {
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
        if (!n || n.depleted) {
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
              text: `+${drone.cargo.length} 🤖`,
              color: '#a7f3d0'
            });
          }

          drone.cargo = [];
          drone.state = 'seek';
        } else {
          drone.x += (dx / dist) * spd * 1.15 * dt;
          drone.y += (dy / dist) * spd * 1.15 * dt;
        }
      }
    });
  }
}
