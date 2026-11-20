import { describe, expect, it, vi } from 'vitest';
import { PlayerInteractionController } from '../../src/app/PlayerInteractionController.ts';
import { GameRuntimeContext } from '../../src/app/GameContext.ts';

it('opens a nearby construction card only on interaction, then deposits on the next interaction', () => {
  const blueprint = { id: 'sawmill' };
  const card = {
    activeInspectedZone: null as typeof blueprint | null,
    open: vi.fn((target: typeof blueprint) => { card.activeInspectedZone = target; })
  };
  const buildingSystem = {
    getNearbyBlueprint: vi.fn(() => blueprint),
    interactWithBlueprint: vi.fn()
  };
  const player = { x: 0, y: 0 };
  const state = {};
  const context = {
    getIsPlaying: () => true, isModalOpen: () => false,
    getState: () => state, getPlayer: () => player,
    buildingSystem, ui: { inspectionCard: card }
  } as unknown as GameRuntimeContext;
  const controller = new PlayerInteractionController(context);

  expect(card.activeInspectedZone).toBeNull();
  controller.triggerContextInteract();
  expect(card.open).toHaveBeenCalledWith(blueprint);
  expect(buildingSystem.interactWithBlueprint).not.toHaveBeenCalled();
  controller.triggerContextInteract();
  expect(buildingSystem.interactWithBlueprint).toHaveBeenCalledWith('sawmill', state, player);
});
