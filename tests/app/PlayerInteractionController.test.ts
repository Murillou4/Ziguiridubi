import { expect, it, vi } from 'vitest';
import type { GameRuntimeContext } from '../../src/app/GameContext.ts';
import { PlayerInteractionController } from '../../src/app/PlayerInteractionController.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { getDerivedStats } from '../../src/domain/Stats.ts';
import { GatheringSystem } from '../../src/gameplay/GatheringSystem.ts';
import { PlayerSystem } from '../../src/gameplay/PlayerSystem.ts';
import { WorldSystem } from '../../src/gameplay/WorldSystem.ts';

it('prioriza o recurso clicado e limita o golpe direcionado ao mesmo tipo', () => {
  const state = createDefaultState();
  const player = createDefaultPlayer();
  player.y = 0;
  const worldSystem = new WorldSystem();
  worldSystem.nodes = [];
  const rock = worldSystem.spawnNode('rock', 62, 60, 'hub');
  const tree = worldSystem.spawnNode('tree', 62, 0, 'hub');
  const nearbyTree = worldSystem.spawnNode('tree', 75, -58, 'hub');
  const controller = new PlayerInteractionController({
    audio: { init: vi.fn(), playSwing: vi.fn() },
    input: { updateWorldMouse: vi.fn(), mouse: { worldX: 62, worldY: 18 } },
    renderer: {},
    getState: () => state,
    getStats: () => getDerivedStats(state),
    getPlayer: () => player,
    getIsPlaying: () => true,
    isModalOpen: () => false,
    playerSystem: new PlayerSystem(),
    gatheringSystem: new GatheringSystem(new EventBus()),
    worldSystem
  } as unknown as GameRuntimeContext);

  controller.handleCanvasClick();

  expect(player.attackTarget).toBe(tree);
  expect(tree.hp).toBe(tree.maxHp - 1);
  expect(nearbyTree.hp).toBe(nearbyTree.maxHp - 1);
  expect(rock.hp).toBe(rock.maxHp);

  player.cooldownTimer = 0;
  controller.triggerSwing();
  expect(rock.hp).toBe(rock.maxHp - 1);
});
