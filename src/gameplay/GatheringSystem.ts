import { DerivedStats, DropItem, GameState, PlayerState, ResourceNode } from '../domain/types.ts';
import { EventBus } from '../core/EventBus.ts';
import { RESOURCES } from '../config/resources.ts';

export class GatheringSystem {
  public drops: DropItem[] = [];

  constructor(private eventBus: EventBus) {}

  /**
   * Processa o golpe do jogador contra um nó de recurso.
   */
  handleHitNode(
    node: ResourceNode,
    state: GameState,
    stats: DerivedStats
  ): { hit: boolean; isCrit: boolean; depleted: boolean } {
    // 1. Verifica se a ferramenta possui poder suficiente
    if (stats.toolPower < node.reqPower) {
      this.eventBus.emit('sound:hit', { mat: 'stone', isCrit: false });
      this.eventBus.emit('fx:floatingText', {
        x: node.x,
        y: node.y - 26,
        text: `Requer Ferramenta Nv.${node.reqPower}`,
        color: '#fca5a5'
      });
      this.eventBus.emit('fx:burst', { x: node.x, y: node.y, color: '#cbd5e1', count: 6 });
      return { hit: false, isCrit: false, depleted: false };
    }

    // 2. Avaliação de acerto rítmico no Sweet Spot
    let isCrit = false;
    if (node.sweetSpotTimer > 0) {
      const progress = node.sweetSpotTimer / node.sweetSpotDuration;
      if (progress >= 0.10 && progress <= 0.10 + stats.sweetSpotWindow) {
        isCrit = true;
      }
    }

    const dmg = Math.max(1, stats.toolPower - (node.reqPower - 1));
    const depleted = this.damageNode(node, dmg, isCrit, state, stats);

    if (!node.depleted) {
      node.sweetSpotTimer = node.sweetSpotDuration;
    }

    return { hit: true, isCrit, depleted };
  }

  /**
   * Aplica dano ao nó, calcula rendimento e emite drops físicos no mundo.
   */
  damageNode(
    node: ResourceNode,
    dmg: number,
    isCrit: boolean,
    state: GameState,
    stats: DerivedStats
  ): boolean {
    node.hp -= dmg;
    node.hitAnim = 1.0;

    this.eventBus.emit('sound:hit', { mat: node.mat, isCrit });

    if (isCrit) {
      this.eventBus.emit('game:hitstop', { duration: 0.032 });
      this.eventBus.emit('fx:shake', { magnitude: 5.5 });
      state.stats.criticalHits++;
      this.eventBus.emit('fx:floatingText', {
        x: node.x,
        y: node.y - 30,
        text: '★ CRÍTICO!',
        color: '#fde047'
      });
      this.eventBus.emit('fx:burst', { x: node.x, y: node.y, color: '#fde047', count: 16 });
    } else {
      this.eventBus.emit('fx:burst', {
        x: node.x,
        y: node.y,
        color: RESOURCES[node.resource].color,
        count: 8
      });
    }

    let yieldAmt = isCrit ? Math.round(2 * (stats.critMult / 2)) : 1;
    if ((state.upgrades.relicCelestialCore ?? 0) > 0) {
      yieldAmt *= 2;
    }

    let wasDepleted = false;
    if (node.hp <= 0) {
      node.hp = 0;
      node.depleted = true;
      node.respawnTimer = node.respawnTime;
      node.sweetSpotTimer = 0;
      yieldAmt += 1;
      wasDepleted = true;
      this.eventBus.emit('fx:burst', {
        x: node.x,
        y: node.y,
        color: RESOURCES[node.resource].color,
        count: 18
      });
    }

    for (let i = 0; i < yieldAmt; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 90;
      this.drops.push({
        resource: node.resource,
        x: node.x,
        y: node.y,
        z: 14,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: 140 + Math.random() * 60,
        age: 0
      });
    }

    return wasDepleted;
  }

  /**
   * Atualiza a física de arco dos drops no chão e atração magnética para a mochila do jogador.
   */
  updateDrops(
    player: PlayerState,
    stats: DerivedStats,
    dt: number,
    onPickup: (res: DropItem) => void
  ): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;

      // Física 3D parabólica simples
      if (d.z > 0 || d.vz > 0) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.vz -= 430 * dt;
        if (d.z <= 0) {
          d.z = 0;
          d.vz = 0;
          d.vx *= 0.3;
          d.vy *= 0.3;
        }
      }

      // Atração magnética e coleta
      if (d.age > 0.2 && player.backpack.length < stats.maxBackpack) {
        const dx = player.x - d.x;
        const dy = player.y - d.y;
        const dist = Math.hypot(dx, dy);

        if (dist < stats.magnetRadius) {
          const pull = 360 + (1 - dist / stats.magnetRadius) * 280;
          d.x += (dx / Math.max(1, dist)) * pull * dt;
          d.y += (dy / Math.max(1, dist)) * pull * dt;
        }

        if (dist < 24) {
          onPickup(d);
          this.drops.splice(i, 1);
        }
      }
    }
  }
}
