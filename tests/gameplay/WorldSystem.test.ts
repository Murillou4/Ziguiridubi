import { describe, expect, it, vi } from 'vitest';
import { GameSimulationController } from '../../src/app/GameSimulationController.ts';
import { GameRuntimeContext } from '../../src/app/GameContext.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { GameClock } from '../../src/core/GameClock.ts';
import { WorldSystem } from '../../src/gameplay/WorldSystem.ts';

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
});
