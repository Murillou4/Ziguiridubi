import { describe, expect, it } from 'vitest';
import { TutorialController } from '../../src/app/TutorialController.ts';
import { EventBus } from '../../src/core/EventBus.ts';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { createDefaultPlayer } from '../../src/domain/PlayerState.ts';
import { BuildingSystem } from '../../src/gameplay/BuildingSystem.ts';
import { InventorySystem } from '../../src/gameplay/InventorySystem.ts';

function createTutorial() {
  const inventory = new InventorySystem();
  return new TutorialController(inventory, new BuildingSystem(inventory, new EventBus()));
}

describe('TutorialController', () => {
  it('avança na ordem das ações e conclui somente ao receber o depósito na serraria', () => {
    const state = createDefaultState();
    const tutorial = createTutorial();

    tutorial.recordDepletion(state, 'tree');
    expect(state.tutorialStep).toBe('walk');
    expect(tutorial.recordMovement(state, 19)).toBe(false);
    expect(tutorial.recordMovement(state, 18)).toBe(true);

    tutorial.recordDepletion(state, 'rock');
    expect(state.tutorialStep).toBe('wood');
    tutorial.recordDepletion(state, 'tree');
    expect(state.tutorialStep).toBe('stone');
    tutorial.recordDepletion(state, 'rock');
    expect(state.tutorialStep).toBe('collect');

    const drop = { x: 20, y: 30, z: 0, vx: 0, vy: 0, vz: 0, age: 1 } as const;
    tutorial.recordPickup(state, { ...drop, resource: 'ironOre' }, 5);
    expect(tutorial.finishPickup(state, 6)).toBe(false);
    tutorial.recordPickup(state, { ...drop, resource: 'wood' }, 7);
    expect(tutorial.getCue(state, createDefaultPlayer(), [], [], 10)?.action).toBe('pickup');
    expect(tutorial.finishPickup(state, 7.3)).toBe(false);
    expect(tutorial.finishPickup(state, 8)).toBe(true);

    tutorial.recordDeposit(state, 'furnace');
    expect(state.tutorialStep).toBe('deposit');
    tutorial.recordDeposit(state, 'sawmill');
    expect(state.tutorialStep).toBe('done');
  });

  it('guia a aproximação e a abertura da obra antes de indicar a entrega', () => {
    const state = createDefaultState();
    state.tutorialStep = 'deposit';
    const tutorial = createTutorial();
    const player = createDefaultPlayer();
    player.backpack.push('wood');

    const approach = tutorial.getCue(state, player, [], [], 10)!;
    expect(approach.action).toBe('approach');
    player.x = approach.x;
    player.y = approach.y;
    expect(tutorial.getCue(state, player, [], [], 10)?.action).toBe('inspect');
    expect(tutorial.getCue(state, player, [], [], 10, 'sawmill')?.action).toBe('deposit');
  });
});
