import { BLUEPRINTS_DEF, WAREHOUSE_POSITION } from '../config/buildings.ts';
import type { TutorialCue } from '../domain/Tutorial.ts';
import type { DropItem, GameState, NodeType, PlayerState, ResourceId, ResourceNode } from '../domain/types.ts';
import { BuildingSystem } from '../gameplay/BuildingSystem.ts';
import { InventorySystem } from '../gameplay/InventorySystem.ts';

const SAWMILL = BLUEPRINTS_DEF.find(bp => bp.id === 'sawmill')!;
const SAWMILL_CENTER = { x: SAWMILL.x + SAWMILL.w / 2, y: SAWMILL.y + SAWMILL.h / 2 };
const MOVE_DISTANCE = 34;

const isStarterResource = (resource: ResourceId) => resource === 'wood' || resource === 'stone';

function nearest<T extends { x: number; y: number }>(origin: PlayerState, items: readonly T[], qualifies: (item: T) => boolean): T | undefined {
  let best: T | undefined;
  let distance = Infinity;
  for (const item of items) {
    if (!qualifies(item)) continue;
    const distanceSquared = (item.x - origin.x) ** 2 + (item.y - origin.y) ** 2;
    if (distanceSquared >= distance) continue;
    best = item;
    distance = distanceSquared;
  }
  return best;
}

export class TutorialController {
  private state?: GameState;
  private walked = 0;
  private walkTarget?: { x: number; y: number };
  private node?: ResourceNode;
  private pickup?: { drop: DropItem; time: number };

  constructor(private inventory: InventorySystem, private buildings: BuildingSystem) {}

  recordMovement(state: GameState, distance: number): boolean {
    if (state.tutorialStep !== 'walk') return false;
    this.track(state);
    this.walked += distance;
    if (this.walked < MOVE_DISTANCE) return false;
    state.tutorialStep = 'wood';
    return true;
  }

  recordDepletion(state: GameState, type: NodeType): boolean {
    if (state.tutorialStep === 'wood' && type === 'tree') {
      state.tutorialStep = 'stone';
      return true;
    }
    if (state.tutorialStep === 'stone' && type === 'rock') {
      state.tutorialStep = 'collect';
      return true;
    }
    return false;
  }

  recordPickup(state: GameState, drop: DropItem, time: number): void {
    if (state.tutorialStep !== 'collect' || !isStarterResource(drop.resource)) return;
    this.track(state);
    this.pickup ??= { drop, time };
  }

  finishPickup(state: GameState, time: number): boolean {
    if (state.tutorialStep !== 'collect' || this.state !== state || !this.pickup || time - this.pickup.time < .55) return false;
    const build = state.builds.sawmill;
    state.tutorialStep = build?.built || (build?.paid?.wood ?? 0) > 0 ? 'done' : 'deposit';
    return true;
  }

  recordDeposit(state: GameState, blueprint: string): void {
    if (state.tutorialStep === 'deposit' && blueprint === SAWMILL.id) state.tutorialStep = 'done';
  }

  getCue(
    state: GameState, player: PlayerState, nodes: readonly ResourceNode[], drops: readonly DropItem[],
    maxBackpack: number, inspectedBlueprint?: string
  ): TutorialCue | null {
    this.track(state);
    switch (state.tutorialStep) {
      case 'walk': {
        if (!this.walkTarget) {
          const tree = this.findNode(player, nodes, 'tree');
          const dx = (tree?.x ?? player.x + 60) - player.x;
          const dy = (tree?.y ?? player.y) - player.y;
          const fraction = Math.min(1, 64 / Math.max(1, Math.hypot(dx, dy)));
          this.walkTarget = { x: player.x + dx * fraction, y: player.y + dy * fraction };
        }
        return { action: 'walk', ...this.walkTarget, lift: 10 };
      }
      case 'wood': return this.nodeCue(player, nodes, 'tree');
      case 'stone': return this.nodeCue(player, nodes, 'rock');
      case 'collect': {
        if (this.pickup) {
          return { action: 'pickup', x: this.pickup.drop.x, y: this.pickup.drop.y, lift: 12 };
        }
        if (player.backpack.length >= maxBackpack) {
          return { action: 'unload', ...WAREHOUSE_POSITION, lift: 48 };
        }
        const drop = nearest(player, drops, item => isStarterResource(item.resource));
        return drop ? { action: 'pickup', x: drop.x, y: drop.y, lift: drop.z + 16 }
          : this.nodeCue(player, nodes, 'rock');
      }
      case 'deposit': {
        if (this.inventory.getTotalResource(state, player, 'wood') === 0) {
          if (player.backpack.length >= maxBackpack) {
            return { action: 'unload', ...WAREHOUSE_POSITION, lift: 48 };
          }
          const drop = nearest(player, drops, item => item.resource === 'wood');
          return drop ? { action: 'pickup', x: drop.x, y: drop.y, lift: drop.z + 16 }
            : this.nodeCue(player, nodes, 'tree');
        }

        const nearby = this.buildings.getNearbyBlueprint(player.x, player.y, state);
        const action = nearby?.id !== SAWMILL.id ? 'approach'
          : inspectedBlueprint === SAWMILL.id ? 'deposit' : 'inspect';
        return { action, ...SAWMILL_CENTER, lift: 35 };
      }
      default: return null;
    }
  }

  private track(state: GameState): void {
    if (this.state === state) return;
    this.state = state;
    this.walked = 0;
    this.walkTarget = undefined;
    this.node = undefined;
    this.pickup = undefined;
  }

  private findNode(player: PlayerState, nodes: readonly ResourceNode[], type: NodeType): ResourceNode | undefined {
    if (this.node?.type !== type || this.node.depleted) {
      this.node = nearest(player, nodes, node => node.islandId === 'hub' && node.type === type && !node.depleted);
    }
    return this.node;
  }

  private nodeCue(player: PlayerState, nodes: readonly ResourceNode[], type: 'tree' | 'rock'): TutorialCue | null {
    const node = this.findNode(player, nodes, type);
    return node ? { action: type === 'tree' ? 'chop' : 'mine', x: node.x, y: node.y, lift: type === 'tree' ? 66 : 33 }
      : null;
  }
}
