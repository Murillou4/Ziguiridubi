import { expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { getDerivedStats } from '../../src/domain/Stats.ts';
import { GatheringSystem } from '../../src/gameplay/GatheringSystem.ts';
import { WorldSystem } from '../../src/gameplay/WorldSystem.ts';

it('keeps drops on the island when a hit sends them toward an edge', () => {
  const world = new WorldSystem();
  const state = createDefaultState();
  const stats = getDerivedStats(state);
  const player = createDefaultPlayer();
  const gathering = new GatheringSystem(new EventBus());
  const node = world.spawnNode('rock', 480, 100, 'hub');
  const walkable = (x: number, y: number) => world.isPointWalkable(state, x, y);
  const pickup = vi.fn();
  const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.99);

  try {
    gathering.damageNode(node, 1, false, state, stats);
  } finally {
    random.mockRestore();
  }

  for (let frame = 0; frame < 60; frame++) {
    gathering.updateDrops(player, stats, 1 / 60, walkable, pickup);
  }

  const [drop] = gathering.drops;
  expect(drop.z).toBe(0);
  expect(walkable(drop.x, drop.y)).toBe(true);
  expect(drop.x).toBeGreaterThan(node.x);
  expect(pickup).not.toHaveBeenCalled();
});
