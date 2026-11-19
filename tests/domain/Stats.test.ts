import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { getDerivedStats } from '../../src/domain/Stats.ts';

describe('getDerivedStats', () => {
  it('calcula os atributos iniciais', () => {
    const state = createDefaultState();
    const stats = getDerivedStats(state);

    expect(stats.maxBackpack).toBe(10);
    expect(stats.toolPower).toBe(1);
    expect(stats.moveSpeed).toBe(220);
    expect(stats.merchantMult).toBe(1);
  });

  it('aplica upgrades e especialização aos atributos derivados', () => {
    const state = createDefaultState();
    state.upgrades.toolPower = 2;
    state.upgrades.backpackSize = 1;
    state.upgrades.merchantFavor = 2;
    state.specialization = 'artisan';

    const stats = getDerivedStats(state);

    expect(stats.toolPower).toBe(3);
    expect(stats.maxBackpack).toBe(16);
    expect(stats.merchantMult).toBeCloseTo(1.65);
    expect(stats.stationSpeedMult).toBeCloseTo(1.6);
  });
});
