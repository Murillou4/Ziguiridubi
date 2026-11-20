import { PlayerState } from './types.ts';

export function createDefaultPlayer(): PlayerState {
  return {
    x: 0,
    y: 55,
    vx: 0,
    vy: 0,
    facing: 0,
    tilt: 0,
    walkCycle: 0,
    swingTimer: 0,
    heldTool: 'axe',
    swingDuration: 0.23,
    swingAngleStart: 0,
    swingAngleEnd: 0,
    cooldownTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: 0,
    invulnTimer: 0,
    backpack: [],
    moveTarget: null
  };
}
