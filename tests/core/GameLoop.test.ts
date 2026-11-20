import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../../src/core/GameLoop.ts';

describe('GameLoop background execution & timing', () => {
  let mockNow = 1000;

  beforeEach(() => {
    mockNow = 1000;
    vi.stubGlobal('performance', {
      now: vi.fn(() => mockNow)
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with default options and tracks running state', () => {
    const onUpdate = vi.fn();
    const onRender = vi.fn();
    const loop = new GameLoop(onUpdate, onRender);

    expect(loop.running).toBe(false);
    loop.start();
    expect(loop.running).toBe(true);
    loop.stop();
    expect(loop.running).toBe(false);
  });

  it('steps simulation in single sub-step for small dt at normal refresh rates', () => {
    const steps: { dt: number; isCatchingUp?: boolean }[] = [];
    const loop = new GameLoop(
      (dt, isCatchingUp) => steps.push({ dt, isCatchingUp }),
      vi.fn()
    );

    loop.stepSimulation(0.0166);

    expect(steps).toHaveLength(1);
    expect(steps[0].dt).toBeCloseTo(0.0166, 4);
    expect(steps[0].isCatchingUp).toBe(false);
  });

  it('slices moderate time deltas into 50ms sub-steps without entering catch-up mode', () => {
    const steps: { dt: number; isCatchingUp?: boolean }[] = [];
    const loop = new GameLoop(
      (dt, isCatchingUp) => steps.push({ dt, isCatchingUp }),
      vi.fn()
    );

    // 0.12s total = 2x 0.05s + 1x 0.02s (3 steps <= 4 threshold)
    loop.stepSimulation(0.12);

    expect(steps).toHaveLength(3);
    expect(steps[0].dt).toBeCloseTo(0.05, 4);
    expect(steps[0].isCatchingUp).toBe(false);
    expect(steps[1].dt).toBeCloseTo(0.05, 4);
    expect(steps[1].isCatchingUp).toBe(false);
    expect(steps[2].dt).toBeCloseTo(0.02, 4);
    expect(steps[2].isCatchingUp).toBe(false);
  });

  it('flags isCatchingUp on intermediate steps during large offline catch-up, but clears on final step', () => {
    const steps: { dt: number; isCatchingUp?: boolean }[] = [];
    const loop = new GameLoop(
      (dt, isCatchingUp) => steps.push({ dt, isCatchingUp }),
      vi.fn()
    );

    // 0.5s = 10 steps of 0.05s (> 4 steps -> catch-up mode)
    loop.stepSimulation(0.5);

    expect(steps).toHaveLength(10);
    // Steps 0..8 should have isCatchingUp = true
    for (let i = 0; i < 9; i++) {
      expect(steps[i].dt).toBeCloseTo(0.05, 4);
      expect(steps[i].isCatchingUp).toBe(true);
    }
    // Final step must have isCatchingUp = false to sync HUD/UI
    expect(steps[9].dt).toBeCloseTo(0.05, 4);
    expect(steps[9].isCatchingUp).toBe(false);
  });

  it('clamps extreme elapsed time to maxCatchupSec to avoid infinite freezing', () => {
    const steps: { dt: number; isCatchingUp?: boolean }[] = [];
    const loop = new GameLoop(
      (dt, isCatchingUp) => steps.push({ dt, isCatchingUp }),
      vi.fn(),
      { maxCatchupSec: 1.0, maxSubStepSec: 0.05 }
    );

    // 500 seconds requested, but clamped to 1.0s (20 steps)
    loop.stepSimulation(500);

    expect(steps).toHaveLength(20);
    const totalSimulated = steps.reduce((sum, s) => sum + s.dt, 0);
    expect(totalSimulated).toBeCloseTo(1.0, 4);
  });

  it('advances simulation and skips onRender when tab is in background (document.hidden = true)', () => {
    vi.stubGlobal('document', {
      hidden: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const onUpdate = vi.fn();
    const onRender = vi.fn();
    const loop = new GameLoop(onUpdate, onRender);
    loop.start();

    // Advance time by 30ms (one background tick)
    mockNow += 30;
    loop.onBackgroundTick();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(expect.closeTo(0.03, 3), false);
    // Rendering should be skipped in background to save GPU & battery
    expect(onRender).not.toHaveBeenCalled();

    loop.stop();
  });

  it('yields when tab is visible and rAF has recently updated', () => {
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const onUpdate = vi.fn();
    const onRender = vi.fn();
    const loop = new GameLoop(onUpdate, onRender);
    loop.start();

    // Only 16ms passed and tab is visible (rAF handles this)
    mockNow += 16;
    loop.onBackgroundTick();

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onRender).not.toHaveBeenCalled();

    loop.stop();
  });
});
