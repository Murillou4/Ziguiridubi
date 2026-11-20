import { describe, expect, it } from 'vitest';
import { InputManager } from '../../src/input/InputManager.ts';
import { EventBus } from '../../src/core/EventBus.ts';

describe('InputManager background defocus & blur protection', () => {
  it('resets all held keys and joystick state when resetInputs is called', () => {
    const eventBus = new EventBus();
    const input = new InputManager(eventBus);

    input.keys['KeyW'] = true;
    input.keys['KeyD'] = true;
    input.virtualJoystick.state.active = true;
    input.virtualJoystick.state.dx = 0.8;
    input.virtualJoystick.state.dy = -0.6;

    input.resetInputs();

    expect(input.keys).toEqual({});
    expect(input.virtualJoystick.state.active).toBe(false);
    expect(input.virtualJoystick.state.dx).toBe(0);
    expect(input.virtualJoystick.state.dy).toBe(0);
  });
});
